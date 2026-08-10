import { assertEquals } from "@std/assert";
import { html, streamHtml } from "@bastianplsfix/html/response";

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

Deno.test("streamHtml creates a streaming Web Standard response", async () => {
  async function* content() {
    yield <h1>Hello</h1>;
    await Promise.resolve();
    yield <p>Streamed</p>;
  }

  const response = streamHtml(content(), {
    status: 202,
    headers: { "x-example": "yes" },
  });

  assertEquals(response.status, 202);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertEquals(response.headers.get("x-example"), "yes");
  assertEquals(await response.text(), "<h1>Hello</h1><p>Streamed</p>");
});

Deno.test("response helpers pass signals and warnings to renderers", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");
  controller.abort(reason);

  assertEquals(
    await html(<p>Never rendered</p>, { signal: controller.signal }).catch(
      (error) => error,
    ),
    reason,
  );

  const aborted = streamHtml(<p>Never rendered</p>, {
    signal: controller.signal,
  });
  assertEquals(await aborted.text().catch((error) => error), reason);

  const bufferedWarnings: string[] = [];
  const streamedWarnings: string[] = [];
  const dangerousHref = ["javascript:", "alert(1)"].join("");
  await html(<a href={dangerousHref}>Buffered</a>, {
    onWarning: (warning) => bufferedWarnings.push(warning.code),
  });
  const streamed = streamHtml(<a href={dangerousHref}>Streamed</a>, {
    onWarning: (warning) => streamedWarnings.push(warning.code),
  });
  await streamed.text();

  assertEquals(bufferedWarnings, ["dangerous-url-scheme"]);
  assertEquals(streamedWarnings, ["dangerous-url-scheme"]);
});
