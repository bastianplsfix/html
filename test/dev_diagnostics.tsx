import { assertRejects, assertStringIncludes } from "@std/assert";
import {
  type Renderable,
  RenderError,
  renderToString,
} from "@bastianplsfix/html";

Deno.test("the development JSX transform retains component locations", async () => {
  function BrokenComponent(): Renderable {
    return { unexpected: true } as unknown as Renderable;
  }

  const error = await assertRejects(
    () => renderToString(<BrokenComponent />),
    RenderError,
  );

  assertStringIncludes(error.message, "at <BrokenComponent>");
  assertStringIncludes(error.message, "dev_diagnostics.tsx:");
});

Deno.test("the development JSX transform locates invalid elements", async () => {
  const attributes = { "bad name": "value" };

  const error = await assertRejects(
    () => renderToString(<div {...attributes}>content</div>),
    RenderError,
  );

  assertStringIncludes(error.message, "Invalid HTML attribute name");
  assertStringIncludes(error.message, "Element: <div>");
  assertStringIncludes(error.message, "dev_diagnostics.tsx:");
});
