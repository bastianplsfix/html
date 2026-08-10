interface ReleaseMetadata {
  readonly tag: string;
  readonly version: string;
  readonly notes: string;
}

if (import.meta.main) {
  const [command, argument] = Deno.args;

  switch (command) {
    case "version": {
      const version = await verifyReleaseVersionReferences();
      console.log(`Release references match package version ${version}.`);
      break;
    }
    case "verify": {
      const metadata = await readReleaseMetadata(argument);
      console.log(
        `Release ${metadata.tag} matches deno.json and has changelog notes.`,
      );
      break;
    }
    case "notes": {
      const metadata = await readReleaseMetadata(argument);
      const outputPath = Deno.env.get("RELEASE_NOTES_PATH");
      if (!outputPath) {
        throw new Error(
          "RELEASE_NOTES_PATH is required for the notes command.",
        );
      }
      await Deno.writeTextFile(outputPath, `${metadata.notes.trim()}\n`);
      console.log(`Wrote release notes for ${metadata.tag} to ${outputPath}.`);
      break;
    }
    default:
      throw new TypeError(
        "Usage: release.ts <version|verify|notes> [vX.Y.Z]",
      );
  }
}

interface VersionReferenceExpectation {
  readonly path: string;
  readonly text: string;
  readonly description: string;
}

/** Return the repository references that must move with a package version. */
export function releaseVersionExpectations(
  version: string,
): readonly VersionReferenceExpectation[] {
  const [major, minor] = version.split(".");
  const series = `${major}.${minor}`;
  const specifier = `jsr:@bastianplsfix/html@^${version}`;

  return [
    {
      path: "README.md",
      text: `deno add ${specifier}`,
      description: "README install command",
    },
    {
      path: "README.md",
      text: `\"@bastianplsfix/html\": \"${specifier}\"`,
      description: "README import map",
    },
    {
      path: "DESIGN.md",
      text: `\"@bastianplsfix/html\": \"${specifier}\"`,
      description: "design import map",
    },
    {
      path: "docs/content/examples.ts",
      text: `\"@bastianplsfix/html\": \"${specifier}\"`,
      description: "documentation configuration example",
    },
    {
      path: "docs/pages/api.tsx",
      text: `<code>${specifier}</code>`,
      description: "documentation API install specifier",
    },
    {
      path: "docs/components/layout.tsx",
      text: `<span>${series}</span>`,
      description: "documentation sidebar release series",
    },
    {
      path: "docs/test/handler_test.ts",
      text: `\"x-html-version\"), \"${version}\"`,
      description: "documentation version-header assertion",
    },
  ];
}

/** Find stale release references without reading from the filesystem. */
export function findReleaseVersionDrift(
  version: string,
  sources: Readonly<Record<string, string>>,
): readonly string[] {
  const errors: string[] = [];

  for (const expectation of releaseVersionExpectations(version)) {
    const source = sources[expectation.path];
    if (source === undefined) {
      errors.push(`Missing release reference source ${expectation.path}.`);
    } else if (!source.includes(expectation.text)) {
      errors.push(
        `${expectation.description} in ${expectation.path} must contain ${
          JSON.stringify(expectation.text)
        }.`,
      );
    }
  }

  const changelog = sources["CHANGELOG.md"];
  if (changelog === undefined) {
    errors.push("Missing release reference source CHANGELOG.md.");
  } else {
    const firstHeading = /^## ([^\s—]+)/m.exec(changelog)?.[1];
    if (firstHeading !== version) {
      errors.push(
        `The first CHANGELOG.md release must be ${version}, found ${
          firstHeading ?? "none"
        }.`,
      );
    }
  }

  const packageSpecifier =
    /jsr:@bastianplsfix\/html@\^?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/gu;
  for (
    const path of [
      "README.md",
      "DESIGN.md",
      "docs/content/examples.ts",
      "docs/pages/api.tsx",
    ]
  ) {
    const source = sources[path];
    if (source === undefined) continue;
    for (const match of source.matchAll(packageSpecifier)) {
      if (match[1] !== version) {
        errors.push(
          `Stale package version ${match[1]} in ${path}; expected ${version}.`,
        );
      }
    }
  }

  return errors;
}

/** Verify every release-controlled version reference in the working tree. */
export async function verifyReleaseVersionReferences(): Promise<string> {
  const config = JSON.parse(await Deno.readTextFile("deno.json")) as {
    readonly version?: unknown;
  };
  if (
    typeof config.version !== "string" ||
    !isSemanticVersion(config.version)
  ) {
    throw new Error("deno.json must contain a valid semantic version.");
  }

  const paths = new Set([
    "CHANGELOG.md",
    ...releaseVersionExpectations(config.version).map(({ path }) => path),
  ]);
  const sources: Record<string, string> = {};
  for (const path of paths) {
    sources[path] = await Deno.readTextFile(path);
  }

  const drift = findReleaseVersionDrift(config.version, sources);
  if (drift.length > 0) {
    throw new Error(`Release version drift:\n- ${drift.join("\n- ")}`);
  }

  return config.version;
}

async function readReleaseMetadata(
  tagArgument?: string,
): Promise<ReleaseMetadata> {
  const version = await verifyReleaseVersionReferences();

  const tag = tagArgument ?? Deno.env.get("GITHUB_REF_NAME");
  if (!tag) {
    throw new Error("Pass a release tag or set GITHUB_REF_NAME.");
  }
  if (tag !== `v${version}`) {
    throw new Error(
      `Tag ${tag} does not match package version v${version}.`,
    );
  }

  const changelog = await Deno.readTextFile("CHANGELOG.md");
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(
    `^## ${escapedVersion}(?: [^\\n]*)?$`,
    "m",
  ).exec(changelog);
  const remainder = heading
    ? changelog.slice(heading.index + heading[0].length)
    : "";
  const nextHeading = remainder.search(/^## /m);
  const notes = (
    nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)
  ).trim();
  if (!heading || !notes) {
    throw new Error(
      `CHANGELOG.md needs a non-empty \"## ${version}\" section.`,
    );
  }

  return {
    tag,
    version,
    notes,
  };
}

/** Return whether a value is a complete SemVer 2.0 version. */
export function isSemanticVersion(value: string): boolean {
  const numeric = "(?:0|[1-9]\\d*)";
  const identifier = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
  const buildIdentifier = "[0-9A-Za-z-]+";
  return new RegExp(
    `^${numeric}\\.${numeric}\\.${numeric}` +
      `(?:-${identifier}(?:\\.${identifier})*)?` +
      `(?:\\+${buildIdentifier}(?:\\.${buildIdentifier})*)?$`,
  ).test(value);
}
