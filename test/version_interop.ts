import { assertEquals } from "@std/assert";
import { type Renderable, renderToString } from "@current/html";

function legacyUrl(path: string): string {
  return [
    "https://jsr.io/",
    "@bastianplsfix/html/",
    "0.1.0/",
    path,
  ].join("");
}

const { unsafeHTML: legacyUnsafeHTML } = await import(
  legacyUrl("mod.ts")
) as {
  unsafeHTML(value: string): unknown;
};

const { jsx: legacyJsx } = await import(
  legacyUrl("jsx-runtime.ts")
) as {
  jsx(type: string, props: Record<string, unknown> | null): unknown;
};

Deno.test("published 0.1 instructions use the version-one protocol", async () => {
  const legacyView = legacyJsx("section", {
    class: "legacy",
    children: ["<escaped>", legacyUnsafeHTML("<b>trusted library</b>")],
  });

  assertEquals(
    await renderToString(legacyView as unknown as Renderable),
    '<section class="legacy">&lt;escaped&gt;<b>trusted library</b></section>',
  );
});
