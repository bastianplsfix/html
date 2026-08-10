interface ReleaseMetadata {
  readonly tag: string;
  readonly version: string;
  readonly notes: string;
}

if (import.meta.main) {
  const [command, argument] = Deno.args;
  const metadata = await readReleaseMetadata(argument);

  switch (command) {
    case "verify":
      console.log(
        `Release ${metadata.tag} matches deno.json and has changelog notes.`,
      );
      break;
    case "notes": {
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
      throw new TypeError("Usage: release.ts <verify|notes> [vX.Y.Z]");
  }
}

async function readReleaseMetadata(
  tagArgument?: string,
): Promise<ReleaseMetadata> {
  const config = JSON.parse(await Deno.readTextFile("deno.json")) as {
    readonly version?: unknown;
  };
  if (
    typeof config.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(config.version)
  ) {
    throw new Error("deno.json must contain a valid semantic version.");
  }

  const tag = tagArgument ?? Deno.env.get("GITHUB_REF_NAME");
  if (!tag) {
    throw new Error("Pass a release tag or set GITHUB_REF_NAME.");
  }
  if (tag !== `v${config.version}`) {
    throw new Error(
      `Tag ${tag} does not match package version v${config.version}.`,
    );
  }

  const changelog = await Deno.readTextFile("CHANGELOG.md");
  const escapedVersion = config.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      `CHANGELOG.md needs a non-empty \"## ${config.version}\" section.`,
    );
  }

  return {
    tag,
    version: config.version,
    notes,
  };
}
