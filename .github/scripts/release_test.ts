import { assertEquals } from "@std/assert";
import { isSemanticVersion } from "./release.ts";

Deno.test("release versions follow SemVer 2.0", () => {
  for (
    const value of [
      "0.2.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-0.3.7",
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
