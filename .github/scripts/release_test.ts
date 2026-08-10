import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  findReleaseVersionDrift,
  isSemanticVersion,
  releaseVersionExpectations,
} from "./release.ts";
import { createPublishedConsumerConfig } from "./published_smoke.ts";

Deno.test("release versions follow SemVer 2.0", () => {
  for (
    const value of [
      "0.2.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-0.3.7",
      "1.0.0-1alpha",
      "1.0.0-01a",
      "1.0.0-1-",
      "1.0.0+build.5",
    ]
  ) {
    assertEquals(isSemanticVersion(value), true, value);
  }

  for (
    const value of [
      "1",
      "1.2",
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "1.2.3-alpha..1",
      "1.2.3-01",
      "v1.2.3",
    ]
  ) {
    assertEquals(isSemanticVersion(value), false, value);
  }
});

Deno.test("release-controlled version references stay synchronized", () => {
  const version = "0.2.0";
  const sources: Record<string, string> = {
    "CHANGELOG.md": `# Changelog\n\n## ${version} — today\n\n- Notes.`,
    // The independently runnable example intentionally follows only versions
    // that already exist in JSR and is outside the release-controlled set.
    "examples/hello/deno.json": "jsr:@bastianplsfix/html@^0.1.0",
  };
  for (const { path, text } of releaseVersionExpectations(version)) {
    sources[path] = `${sources[path] ?? ""}\n${text}`;
  }

  assertEquals(findReleaseVersionDrift(version, sources), []);

  sources["README.md"] = sources["README.md"].replaceAll(version, "0.1.0");
  const drift = findReleaseVersionDrift(version, sources);
  assertEquals(drift.length > 0, true);
  assertStringIncludes(drift.join("\n"), "README install command");
  assertStringIncludes(drift.join("\n"), "Stale package version 0.1.0");
});

Deno.test("published smoke accepts a brand-new exact version", () => {
  const source = createPublishedConsumerConfig(
    "@bastianplsfix/html",
    "jsr:@bastianplsfix/html@0.2.0",
  );
  const config = JSON.parse(source) as {
    readonly minimumDependencyAge?: unknown;
    readonly imports?: Readonly<Record<string, unknown>>;
  };

  assertEquals(config.minimumDependencyAge, 0);
  assertEquals(
    config.imports?.["@bastianplsfix/html"],
    "jsr:@bastianplsfix/html@0.2.0",
  );
});
