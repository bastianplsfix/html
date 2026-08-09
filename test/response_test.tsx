import { assertEquals } from "@std/assert";
import { html } from "@bastianplsfix/html/response";

Deno.test("html creates a Web Standard response", async () => {
  const response = await html(<h1>Hello</h1>, {
    status: 201,
    headers: { "x-example": "yes" },
  });

  assertEquals(response.status, 201);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertEquals(response.headers.get("x-example"), "yes");
  assertEquals(await response.text(), "<h1>Hello</h1>");
});

Deno.test("html preserves an explicit content type", async () => {
  const response = await html(<p>Hello</p>, {
    headers: { "content-type": "text/html" },
  });

  assertEquals(response.headers.get("content-type"), "text/html");
});
