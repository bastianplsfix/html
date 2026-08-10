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

Deno.test("response helpers pass abort signals to the renderer", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");
  controller.abort(reason);

  assertEquals(
    await html(<p>Never rendered</p>, { signal: controller.signal }).catch(
      (error) => error,
    ),
    reason,
  );

  const response = streamHtml(<p>Never rendered</p>, {
    signal: controller.signal,
  });
  assertEquals(await response.text().catch((error) => error), reason);
});

Deno.test("response helpers forward render warnings", async () => {
  const bufferedWarnings: string[] = [];
  const streamedWarnings: string[] = [];

  await html(<a href="javascript:alert(1)">Buffered</a>, {
    onWarning: (warning) => bufferedWarnings.push(warning.code),
  });
  const response = streamHtml(<a href="javascript:alert(1)">Streamed</a>, {
    onWarning: (warning) => streamedWarnings.push(warning.code),
  });
  await response.text();

  assertEquals(bufferedWarnings, ["dangerous-url-scheme"]);
  assertEquals(streamedWarnings, ["dangerous-url-scheme"]);
});
