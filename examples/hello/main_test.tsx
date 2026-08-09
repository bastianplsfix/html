import { assertEquals, assertStringIncludes } from "@std/assert";
import { handler } from "./main.tsx";

Deno.test("renders through the published JSX runtime", async () => {
  const response = await handler(
    new Request("https://example.test/?name=%3Cscript%3Ealert(1)%3C/script%3E"),
  );
  const body = await response.text();

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertStringIncludes(body, "<!doctype html>");
  assertStringIncludes(body, "&lt;script&gt;alert(1)&lt;/script&gt;");
});

Deno.test("returns a plain 404 outside the example route", async () => {
  const response = await handler(new Request("https://example.test/missing"));

  assertEquals(response.status, 404);
  assertEquals(await response.text(), "Not found");
});
