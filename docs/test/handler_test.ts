import { assertEquals, assertStringIncludes } from "@std/assert";
import { handler } from "../app/handler.tsx";

Deno.test("docs home is rendered by the framework", async () => {
  const response = await handler(new Request("https://docs.example/"));
  const body = await response.text();

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertStringIncludes(body, "<!doctype html>");
  assertStringIncludes(body, '<html lang="en" class="light">');
  assertStringIncludes(
    body,
    'class="wordmark" href="/">@bastianplsfix/html</a>',
  );
  assertStringIncludes(body, "HTML is the output.");
  assertStringIncludes(body, 'href="/styles.css?v=light"');
  assertStringIncludes(body, "These docs are rendered by");
});

Deno.test("docs render every registered page", async () => {
  const expectations = [
    ["/getting-started", "Getting started"],
    ["/concepts", "Core concepts"],
    ["/security", "Security model"],
    ["/api", "API reference"],
  ] as const;

  for (const [path, heading] of expectations) {
    const response = await handler(new Request(`https://docs.example${path}`));
    assertEquals(response.status, 200);
    assertStringIncludes(await response.text(), `<h1>${heading}</h1>`);
  }
});

Deno.test("docs return a rendered 404 page", async () => {
  const response = await handler(
    new Request("https://docs.example/not-a-real-page"),
  );
  const body = await response.text();

  assertEquals(response.status, 404);
  assertStringIncludes(body, "This page did not render.");
  assertStringIncludes(body, "<code>/not-a-real-page</code>");
});

Deno.test("docs canonicalize trailing slashes", async () => {
  const response = await handler(
    new Request("https://docs.example/security/?source=test"),
  );

  assertEquals(response.status, 308);
  assertEquals(
    response.headers.get("location"),
    "https://docs.example/security?source=test",
  );
});

Deno.test("docs support HEAD without returning a body", async () => {
  const response = await handler(
    new Request("https://docs.example/api", { method: "HEAD" }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
});

Deno.test("docs reject unsupported methods", async () => {
  const response = await handler(
    new Request("https://docs.example/", { method: "POST" }),
  );

  assertEquals(response.status, 405);
  assertEquals(response.headers.get("allow"), "GET, HEAD");
});

Deno.test({
  name: "docs serve their stylesheet",
  permissions: { read: ["docs/static/styles.css"] },
  async fn() {
    const response = await handler(
      new Request("https://docs.example/styles.css"),
    );

    assertEquals(response.status, 200);
    assertEquals(
      response.headers.get("content-type"),
      "text/css; charset=utf-8",
    );
    assertEquals(response.headers.get("cache-control"), "no-store");
    const css = await response.text();
    assertStringIncludes(css, "--bs-color-accent: #335cff");
    assertStringIncludes(css, ".docs-shell");
  },
});
