import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type Renderable,
  RenderError,
  renderToString,
  unsafeHTML,
} from "@bastianplsfix/html";
import {
  Fragment,
  jsx,
  jsxEscape,
  jsxTemplate,
} from "@bastianplsfix/html/jsx-runtime";

function renderable(value: unknown): Renderable {
  return value as Renderable;
}

Deno.test("precompiled raw-text opening tags fail closed", async () => {
  const cases = [
    jsxTemplate(["<script>", "</script>"], jsxEscape("alert(1)")),
    jsxTemplate(["<style>", "</style>"], jsxEscape("body{}")),
    jsxTemplate(
      ['<ScRiPt type="application/json">', "</ScRiPt>"],
      jsxEscape("{}"),
    ),
    jsxTemplate(
      ['<STYLE media="screen">', "</STYLE>"],
      jsxEscape("body{}"),
    ),
  ];

  for (const view of cases) {
    const error = await assertRejects(() => renderToString(view), RenderError);
    assertStringIncludes(error.message, "Deno precompiled");
    assertStringIncludes(error.message, "jsxPrecompileSkipElements");
    assertStringIncludes(error.message, '"script", "style"');
  }
});

Deno.test("precompile guard distinguishes safe markup and lookalikes", async () => {
  const cases: Array<readonly [ReturnType<typeof jsxTemplate>, string]> = [
    [
      jsxTemplate(["<main><h1>", "</h1></main>"], jsxEscape("<safe>")),
      "<main><h1>&lt;safe&gt;</h1></main>",
    ],
    [
      jsxTemplate(["<scripture>text</scripture>"]),
      "<scripture>text</scripture>",
    ],
    [
      jsxTemplate(["<p>&lt;script&gt; and &lt;style&gt;</p>"]),
      "<p>&lt;script&gt; and &lt;style&gt;</p>",
    ],
    [
      jsxTemplate(['<div title="<script>">safe</div>']),
      '<div title="<script>">safe</div>',
    ],
    [
      jsxTemplate(["<!-- <script>comment</script> --><p>safe</p>"]),
      "<!-- <script>comment</script> --><p>safe</p>",
    ],
    [jsxTemplate(["1 < 2 <p>safe</p>"]), "1 < 2 <p>safe</p>"],
  ];

  for (const [view, expected] of cases) {
    assertEquals(await renderToString(view), expected);
  }
});

Deno.test("raw-text policy crosses components, promises, and fragments", async () => {
  async function AsyncPayload() {
    await Promise.resolve();
    return "plain script";
  }

  function NestedPayload() {
    return <AsyncPayload />;
  }

  const componentError = await assertRejects(
    () =>
      renderToString(
        <script>
          <NestedPayload />
        </script>,
      ),
    RenderError,
  );
  assertEquals(
    componentError.componentStack.map((frame) => frame.name),
    ["AsyncPayload", "NestedPayload"],
  );
  assertEquals(componentError.element?.name, "script");
  assertStringIncludes(componentError.message, "raw-text elements");

  const promiseError = await assertRejects(
    () => renderToString(<style>{Promise.resolve("plain style")}</style>),
    RenderError,
  );
  assertEquals(promiseError.element?.name, "style");

  const fragmentError = await assertRejects(
    () =>
      renderToString(
        <script>
          {jsx(Fragment, {
            children: [unsafeHTML("trusted;"), "plain"],
          })}
        </script>,
      ),
    RenderError,
  );
  assertEquals(fragmentError.element?.name, "script");
});

Deno.test("raw-text policy crosses sync and async iterables", async () => {
  function* syncPayload(): Iterable<Renderable> {
    yield unsafeHTML("trusted;");
    yield "plain";
  }

  async function* asyncPayload(): AsyncIterable<Renderable> {
    yield unsafeHTML("trusted;");
    await Promise.resolve();
    yield "plain";
  }

  for (const children of [syncPayload(), asyncPayload()]) {
    const error = await assertRejects(
      () => renderToString(<script>{children}</script>),
      RenderError,
    );
    assertEquals(error.element?.name, "script");
    assertStringIncludes(error.message, "Plain renderable values");
  }
});

Deno.test("trusted raw text survives every supported container", async () => {
  async function TrustedComponent() {
    await Promise.resolve();
    return unsafeHTML("component;");
  }
  function* syncPayload(): Iterable<Renderable> {
    yield unsafeHTML("sync;");
  }
  async function* asyncPayload(): AsyncIterable<Renderable> {
    yield unsafeHTML("async;");
  }

  assertEquals(
    await renderToString(
      <script>
        {jsx(Fragment, {
          children: [
            <TrustedComponent />,
            Promise.resolve(unsafeHTML("promise;")),
            syncPayload(),
            asyncPayload(),
          ],
        })}
      </script>,
    ),
    "<script>component;promise;sync;async;</script>",
  );
});

Deno.test("unsupported-value descriptions do not execute object hooks", async () => {
  let getterCalls = 0;
  let toJSONCalls = 0;
  const hostile = {
    toJSON() {
      toJSONCalls++;
      return { serialized: true };
    },
  } as Record<string, unknown>;
  Object.defineProperty(hostile, "secret", {
    enumerable: true,
    get() {
      getterCalls++;
      throw new Error("getter must not run");
    },
  });

  const error = await assertRejects(
    () => renderToString(renderable(hostile)),
    RenderError,
  );
  assertStringIncludes(error.message, "Received: [Object]");
  assertEquals(getterCalls, 0);
  assertEquals(toJSONCalls, 0);
});

Deno.test("unsupported-value descriptions do not inspect Proxy internals", async () => {
  let ownKeyReads = 0;
  let functionNameReads = 0;
  const propertyReads: PropertyKey[] = [];
  const objectProxy = new Proxy({}, {
    get(target, property, receiver) {
      propertyReads.push(property);
      return Reflect.get(target, property, receiver);
    },
    ownKeys(target) {
      ownKeyReads++;
      return Reflect.ownKeys(target);
    },
  });
  const functionProxy = new Proxy(() => {}, {
    get(target, property, receiver) {
      if (property === "name") {
        functionNameReads++;
      }
      return Reflect.get(target, property, receiver);
    },
  });

  const objectError = await assertRejects(
    () => renderToString(renderable(objectProxy)),
    RenderError,
  );
  const functionError = await assertRejects(
    () => renderToString(renderable(functionProxy)),
    RenderError,
  );

  assertStringIncludes(objectError.message, "Received: [Object]");
  assertStringIncludes(functionError.message, "Received: [Function]");
  assertEquals(ownKeyReads, 0);
  assertEquals(functionNameReads, 0);
  assertEquals(propertyReads.includes("toJSON"), false);
  assertEquals(propertyReads.includes(Symbol.toStringTag), false);
});

Deno.test("unsupported-value descriptions remain bounded", async () => {
  const large = {
    values: Array.from({ length: 100_000 }, (_, index) => ({ index })),
  };
  const objectError = await assertRejects(
    () => renderToString(renderable(large)),
    RenderError,
  );
  assert(objectError.message.length < 300);

  const symbolError = await assertRejects(
    () => renderToString(renderable(Symbol("x".repeat(10_000)))),
    RenderError,
  );
  assert(symbolError.message.length < 300);

  const nativeError = new Error("x".repeat(10_000));
  const errorDescription = await assertRejects(
    () => renderToString(renderable(nativeError)),
    RenderError,
  );
  assert(errorDescription.message.length < 300);
});

Deno.test("buffered traversal yields to timer-driven aborts", async () => {
  const controller = new AbortController();
  const reason = new DOMException("request ended", "AbortError");
  const total = 20_000;
  let componentCalls = 0;

  function Item() {
    componentCalls++;
    return "item";
  }

  const item = <Item />;
  const items = Array.from({ length: total }, () => item);
  setTimeout(() => controller.abort(reason), 0);

  assertEquals(
    await renderToString(items, { signal: controller.signal }).catch(
      (error) => error,
    ),
    reason,
  );
  assert(componentCalls > 0);
  assert(componentCalls < total);
});

Deno.test("abort detaches hanging cleanup without hiding primary failure", async () => {
  const controller = new AbortController();
  const primary = new Error("render failed first");
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();

  const source = renderable({
    [Symbol.asyncIterator]() {
      return {
        next() {
          return Promise.resolve({
            done: false,
            value: Promise.reject(primary),
          });
        },
        return() {
          cleanupStarted.resolve();
          return cleanup.promise;
        },
      };
    },
  });

  const rendering = renderToString(source, { signal: controller.signal });
  await cleanupStarted.promise;
  controller.abort(new DOMException("request ended", "AbortError"));

  const error = await assertRejects(() => rendering, RenderError);
  assertEquals(error.cause, primary);
  cleanup.resolve({ done: true, value: undefined });
});
