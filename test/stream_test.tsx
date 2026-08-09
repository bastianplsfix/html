import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type Renderable,
  RenderError,
  renderToStream,
} from "@bastianplsfix/html";

async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<{ readonly chunks: number; readonly html: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let chunks = 0;
  let html = "";

  while (true) {
    const result = await reader.read();
    if (result.done) {
      html += decoder.decode();
      return { chunks, html };
    }

    chunks++;
    html += decoder.decode(result.value, { stream: true });
  }
}

Deno.test("renderToStream emits synchronous HTML as UTF-8 chunks", async () => {
  const name = "Ada & Grace";
  const result = await readStream(
    renderToStream(<p class="greeting">Hello, {name}!</p>),
  );

  assert(result.chunks > 1);
  assertEquals(
    result.html,
    `<p class="greeting">Hello, Ada &amp; Grace!</p>`,
  );
});

Deno.test("stream traversal waits for consumer demand", async () => {
  let rendered = false;

  function Deferred() {
    rendered = true;
    return "ready";
  }

  const stream = renderToStream(<Deferred />);
  await Promise.resolve();
  assertEquals(rendered, false);

  const reader = stream.getReader();
  assertEquals(new TextDecoder().decode((await reader.read()).value), "ready");
  assertEquals(rendered, true);
  await reader.cancel();
});

Deno.test("streaming preserves async component and iterable order", async () => {
  async function Badge({ name }: { name: string }) {
    await Promise.resolve();
    return <strong>{name}</strong>;
  }

  async function* messages(): AsyncIterable<Renderable> {
    yield "first";
    await Promise.resolve();
    yield <Badge name="second" />;
  }

  const result = await readStream(
    renderToStream(
      <main>
        before:{messages()}:after
      </main>,
    ),
  );

  assertEquals(
    result.html,
    "<main>before:first<strong>second</strong>:after</main>",
  );
});

Deno.test("stream cancellation closes an active async iterator", async () => {
  let cleanedUp = false;

  async function* values(): AsyncIterable<Renderable> {
    try {
      yield "first";
      await new Promise<never>(() => {});
    } finally {
      cleanedUp = true;
    }
  }

  const reader = renderToStream(values()).getReader();
  const first = await reader.read();
  assertEquals(new TextDecoder().decode(first.value), "first");

  await reader.cancel("consumer stopped");
  assertEquals(cleanedUp, true);
});

Deno.test("an abort signal stops stream traversal and cleans up", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");
  const cleanup = Promise.withResolvers<void>();
  let cleanedUp = false;

  async function* values(): AsyncIterable<Renderable> {
    try {
      yield "first";
      await new Promise<never>(() => {});
    } finally {
      cleanedUp = true;
      cleanup.resolve();
    }
  }

  const reader = renderToStream(values(), { signal: controller.signal })
    .getReader();
  assertEquals(new TextDecoder().decode((await reader.read()).value), "first");

  controller.abort(reason);
  const error = await assertRejects(() => reader.read(), DOMException);
  assertEquals(error, reason);
  await cleanup.promise;
  assertEquals(cleanedUp, true);
});

Deno.test("UTF-8 encoding preserves surrogate pairs across HTML chunks", async () => {
  const emoji = "😀";
  const splitPair: Renderable = [emoji.slice(0, 1), emoji.slice(1)];

  const result = await readStream(renderToStream(splitPair));

  assertEquals(result.html, emoji);
});

Deno.test("rendering failures error a stream with component context", async () => {
  function Broken() {
    return { id: "123" } as unknown as Renderable;
  }

  const reader = renderToStream(
    <>
      prefix<Broken />
    </>,
  ).getReader();
  assertEquals(new TextDecoder().decode((await reader.read()).value), "prefix");

  const error = await assertRejects(() => reader.read(), RenderError);
  assertStringIncludes(error.message, "Cannot render an object as a child");
  assertStringIncludes(error.message, "at <Broken>");
});
