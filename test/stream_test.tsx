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
  renderToString,
} from "@bastianplsfix/html";

async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<{
  readonly byteLengths: readonly number[];
  readonly chunks: number;
  readonly html: string;
}> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const byteLengths: number[] = [];
  let chunks = 0;
  let html = "";

  while (true) {
    const result = await reader.read();
    if (result.done) {
      html += decoder.decode();
      return { byteLengths, chunks, html };
    }

    chunks++;
    byteLengths.push(result.value.byteLength);
    html += decoder.decode(result.value, { stream: true });
  }
}

async function readRemaining(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  while (true) {
    const result = await reader.read();
    if (result.done) {
      return html + decoder.decode();
    }
    html += decoder.decode(result.value, { stream: true });
  }
}

Deno.test("renderToStream emits synchronous HTML as UTF-8 chunks", async () => {
  const name = "Ada & Grace";
  const result = await readStream(
    renderToStream(<p class="greeting">Hello, {name}!</p>),
  );

  assertEquals(
    result.html,
    `<p class="greeting">Hello, Ada &amp; Grace!</p>`,
  );
});

Deno.test("buffered and streamed traversal produce identical output", async () => {
  async function AsyncLabel() {
    await Promise.resolve();
    return <em>ready & safe</em>;
  }

  async function* pieces(): AsyncIterable<Renderable> {
    yield "<first>";
    await Promise.resolve();
    yield <AsyncLabel />;
  }

  const view = () => (
    <main data-count={2}>
      start:{pieces()}:end
    </main>
  );

  const buffered = await renderToString(view());
  const streamed = await readStream(renderToStream(view()));
  assertEquals(streamed.html, buffered);
});

Deno.test("stream fast paths observe render side effects once", async () => {
  let componentCalls = 0;
  let iteratorGetterCalls = 0;
  let iteratorFactoryCalls = 0;
  let warningCalls = 0;
  const dangerousHref = "javascript:alert(1)";
  const values: Iterable<Renderable> = {
    get [Symbol.iterator]() {
      iteratorGetterCalls++;
      return function () {
        iteratorFactoryCalls++;
        let yielded = false;
        return {
          next(): IteratorResult<Renderable> {
            if (yielded) {
              return { done: true, value: undefined };
            }
            yielded = true;
            return { done: false, value: "<item>" };
          },
        };
      };
    },
  };

  function View() {
    componentCalls++;
    return <a href={dangerousHref}>{values}</a>;
  }

  const result = await readStream(renderToStream(<View />, {
    onWarning() {
      warningCalls++;
    },
  }));
  assertEquals(
    result.html,
    `<a href="javascript:alert(1)">&lt;item&gt;</a>`,
  );
  assertEquals(componentCalls, 1);
  assertEquals(iteratorGetterCalls, 1);
  assertEquals(iteratorFactoryCalls, 1);
  assertEquals(warningCalls, 1);
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

Deno.test("streaming flushes a rendered prefix before pending async work", async () => {
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<Renderable>();

  function Pending() {
    started.resolve();
    return pending.promise;
  }

  const reader = renderToStream(
    <main>
      prefix:<Pending />:suffix
    </main>,
  ).getReader();
  const reading = reader.read();
  await started.promise;

  const first = await reading;
  assertEquals(first.done, false);
  assertEquals(new TextDecoder().decode(first.value), "<main>prefix:");

  pending.resolve(<strong>ready</strong>);
  assertEquals(
    await readRemaining(reader),
    "<strong>ready</strong>:suffix</main>",
  );
});

Deno.test("large synchronous trees use bounded coalesced chunks", async () => {
  const itemCount = 2_048;
  const items = Array.from(
    { length: itemCount },
    (_, index) => <li data-index={index}>Item {index}</li>,
  );
  const result = await readStream(renderToStream(<ol>{items}</ol>));

  assert(result.chunks < itemCount / 16);
  assert(result.byteLengths.every((length) => length <= 64 * 1_024));
  assertEquals(result.html, await renderToString(<ol>{items}</ol>));
});

Deno.test("large synchronous chunks stay bounded without splitting UTF-8", async () => {
  const value = "😀".repeat(20_000);
  const result = await readStream(renderToStream(value));

  assert(result.chunks > 1);
  assert(result.byteLengths.every((length) => length <= 64 * 1_024));
  assertEquals(result.html, value);
});

Deno.test("cancelling a coalesced sync stream bounds read-ahead and cleans up", async () => {
  const total = 10_000;
  let yielded = 0;
  let cleanedUp = false;

  function* values(): Iterable<Renderable> {
    try {
      while (yielded < total) {
        yielded++;
        yield "x".repeat(300);
      }
    } finally {
      cleanedUp = true;
    }
  }

  const reader = renderToStream(values()).getReader();
  const first = await reader.read();
  assertEquals(first.done, false);
  assert(yielded > 1);
  assert(yielded < 100);

  await reader.cancel("consumer stopped");
  assertEquals(cleanedUp, true);
  assert(yielded < total);
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
