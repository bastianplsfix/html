import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  doctype,
  type Html,
  type Renderable,
  RenderError,
  type RenderWarning,
  renderToStream,
  renderToString,
  scriptJSON,
  unsafeHTML,
} from "@bastianplsfix/html";
import {
  jsx as runtimeJsx,
  jsxTemplate as runtimeJsxTemplate,
} from "../jsx-runtime.ts";

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

function malformInstruction(
  base: Html,
  overrides: Record<string, unknown>,
): Renderable {
  const malformed = { ...base, ...overrides };
  const [brand] = Object.getOwnPropertySymbols(base);
  Object.defineProperty(malformed, brand, { value: true });
  return malformed as Renderable;
}

Deno.test("interpolated strings are escaped", async () => {
  const attack = `<script>alert("hello")</script>`;

  const result = await renderToString(<p>{attack}</p>);

  assertEquals(
    result,
    `<p>&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;</p>`,
  );
});

Deno.test("a component returning a string returns escaped text", async () => {
  function Message() {
    return "<strong>Not actually strong</strong>";
  }

  assertEquals(
    await renderToString(<Message />),
    "&lt;strong&gt;Not actually strong&lt;/strong&gt;",
  );
});

Deno.test("components are deferred until rendering", async () => {
  let called = false;

  function Deferred() {
    called = true;
    return <span>rendered</span>;
  }

  const view = <Deferred />;
  assertEquals(called, false);

  assertEquals(await renderToString(view), "<span>rendered</span>");
  assertEquals(called, true);
});

Deno.test("HTML-native and boolean attributes serialize predictably", async () => {
  const name = `" onmouseover="alert(1)`;

  const view = (
    <form class="card">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        value={name}
        readonly
        required={false}
        data-field="email"
      />
    </form>
  );

  assertEquals(
    await renderToString(view),
    `<form class="card"><label for="email">Email</label><input id="email" type="email" value="&quot; onmouseover=&quot;alert(1)" readonly data-field="email"></form>`,
  );
});

Deno.test("inline SVG preserves native attribute spellings", async () => {
  const strokeWidth = 2;

  assertEquals(
    await renderToString(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path
          d="M3 12h18"
          fill-rule="evenodd"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width={strokeWidth}
        />
        <use xlink:href="#icon" />
      </svg>,
    ),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 12h18" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><use xlink:href="#icon"></use></svg>`,
  );
});

Deno.test("custom elements use server-serializable attributes", async () => {
  assertEquals(
    await renderToString(
      <user-avatar
        user-id="123"
        data-state="ready"
        aria-label="User profile"
        disabled
      >
        Profile
      </user-avatar>,
    ),
    `<user-avatar user-id="123" data-state="ready" aria-label="User profile" disabled>Profile</user-avatar>`,
  );
});

Deno.test("custom elements reject object and function attributes", async () => {
  const objectValue = <user-avatar user-id={{ id: "123" }} />;
  const functionValue = <user-avatar on-ready={() => {}} />;

  await assertRejects(
    () => renderToString(objectValue),
    RenderError,
    'Cannot render an object as the "user-id" attribute',
  );
  await assertRejects(
    () => renderToString(functionValue),
    RenderError,
    'Cannot render a function as the "on-ready" attribute',
  );
});

Deno.test("fragments, arrays, promises, and iterables flatten in order", async () => {
  const later = Promise.resolve("three");
  const values = new Set<Renderable>(["one", 2, later]);
  const fourth = <b>four</b>;

  assertEquals(
    await renderToString(
      <>
        {values}
        {[null, false, fourth]}
      </>,
    ),
    "one2three<b>four</b>",
  );
});

Deno.test("async components render in document order", async () => {
  async function UserBadge({ name }: { name: string }) {
    await Promise.resolve();
    return <a href={`/users/${name}`}>{name}</a>;
  }

  assertEquals(
    await renderToString(
      <header>
        Before <UserBadge name="Ada" /> after
      </header>,
    ),
    `<header>Before <a href="/users/Ada">Ada</a> after</header>`,
  );
});

Deno.test("async iterables are consumed in order", async () => {
  async function* messages(): AsyncIterable<Renderable> {
    yield <li>first</li>;
    await Promise.resolve();
    yield <li>second</li>;
  }

  assertEquals(
    await renderToString(<ul>{messages()}</ul>),
    "<ul><li>first</li><li>second</li></ul>",
  );
});

Deno.test("stream rendering matches buffered rendering", async () => {
  async function* messages(): AsyncIterable<Renderable> {
    yield <li>first</li>;
    await Promise.resolve();
    yield <li>second &amp; last</li>;
  }

  const createView = () => <ul class="messages">{messages()}</ul>;

  assertEquals(
    await readStream(renderToStream(createView())),
    await renderToString(createView()),
  );
});

Deno.test("stream rendering does not eagerly exhaust iterables", async () => {
  let produced = 0;

  async function* messages(): AsyncIterable<Renderable> {
    for (let index = 0; index < 100; index++) {
      produced++;
      yield String(index);
    }
  }

  const stream = renderToStream(messages());
  await Promise.resolve();
  assert(produced <= 1);

  const reader = stream.getReader();
  await reader.read();
  await Promise.resolve();
  assert(produced <= 2);
  await reader.cancel();
});

Deno.test("cancelling a stream closes active iterators", async () => {
  let cleanedUp = false;

  async function* messages(): AsyncIterable<Renderable> {
    try {
      yield "first";
      yield "second";
    } finally {
      cleanedUp = true;
    }
  }

  const reader = renderToStream(messages()).getReader();
  const first = await reader.read();
  assertEquals(new TextDecoder().decode(first.value), "first");

  await reader.cancel();

  assert(cleanedUp);
});

Deno.test("stream reads reject with normalized render errors", async () => {
  const invalid = { id: "123" } as unknown as Renderable;
  const reader = renderToStream(invalid).getReader();

  await assertRejects(
    () => reader.read(),
    RenderError,
    "Cannot render an object as a child",
  );
});

Deno.test("unsupported objects throw instead of stringifying implicitly", async () => {
  const value = { id: "123" } as unknown as Renderable;

  const error = await assertRejects(
    () => renderToString(<p>{value}</p>),
    RenderError,
  );

  assertStringIncludes(error.message, "Cannot render an object as a child");
  assertStringIncludes(error.message, `Received: {"id":"123"}`);
});

Deno.test("render errors retain the component path", async () => {
  function TodoRow() {
    return { id: "123" } as unknown as Renderable;
  }

  function TodoList() {
    return <TodoRow />;
  }

  const error = await assertRejects(
    () => renderToString(<TodoList />),
    RenderError,
  );

  assertStringIncludes(error.message, "Component stack:");
  assertStringIncludes(error.message, "at <TodoRow>");
  assertStringIncludes(error.message, "at <TodoList>");
});

Deno.test("unsafeHTML is the explicit escaping bypass", async () => {
  assertEquals(
    await renderToString(
      <article>{unsafeHTML("<strong>trusted</strong>")}</article>,
    ),
    "<article><strong>trusted</strong></article>",
  );
});

Deno.test("doctype composes with a document fragment", async () => {
  assertEquals(
    await renderToString(
      <>
        {doctype()}
        <html lang="en">
          <head>
            <title>Todos</title>
          </head>
          <body>Ready</body>
        </html>
      </>,
    ),
    `<!doctype html><html lang="en"><head><title>Todos</title></head><body>Ready</body></html>`,
  );
});

Deno.test("scriptJSON prevents closing the raw-text element", async () => {
  const data = { close: "</script>", ampersand: "&" };

  assertEquals(
    await renderToString(
      <script type="application/json" id="data">{scriptJSON(data)}</script>,
    ),
    `<script type="application/json" id="data">{"close":"\\u003C/script\\u003E","ampersand":"\\u0026"}</script>`,
  );
});

Deno.test("ordinary script children are rejected", async () => {
  const source = "alert('not trusted')";

  await assertRejects(
    () => renderToString(<script>{source}</script>),
    RenderError,
    "Plain <script> children are not escaped safely",
  );
});

Deno.test("ordinary style children are rejected", async () => {
  await assertRejects(
    () => renderToString(<style>{"body { color: red; }"}</style>),
    RenderError,
    "Plain <style> children are not escaped safely",
  );
});

Deno.test("raw-text elements accept explicitly trusted content", async () => {
  assertEquals(
    await renderToString(
      <>
        <script>{unsafeHTML("console.log('trusted')")}</script>
        <style>{unsafeHTML("body { color: green; }")}</style>
      </>,
    ),
    "<script>console.log('trusted')</script>" +
      "<style>body { color: green; }</style>",
  );
});

Deno.test("raw-text policy applies through components and iterables", async () => {
  function Source() {
    return ["not trusted"];
  }

  await assertRejects(
    () => renderToString(<script><Source /></script>),
    RenderError,
    "Plain <script> children are not escaped safely",
  );
});

Deno.test("streaming never emits an unsafe raw-text child", async () => {
  const reader = renderToStream(<script>{"</script><p>attack"}</script>)
    .getReader();

  assertEquals(new TextDecoder().decode((await reader.read()).value), "<script>");
  await assertRejects(
    () => reader.read(),
    RenderError,
    "Plain <script> children are not escaped safely",
  );
});

Deno.test("spread attributes are validated at render time", async () => {
  const attributes = { "bad name": "surprise" };
  const view = <div {...attributes}>content</div>;

  const error = await assertRejects(
    () => renderToString(view),
    RenderError,
    "Invalid HTML attribute name",
  );

  assert(error.cause instanceof TypeError);
});

Deno.test("dangerous URL schemes produce structured warnings", async () => {
  const warnings: RenderWarning[] = [];
  const href = " \tjava\nscript:alert(1)";

  assertEquals(
    await renderToString(<a href={href}>Open</a>, {
      onWarning: (warning) => warnings.push(warning),
    }),
    `<a href=" \tjava\nscript:alert(1)">Open</a>`,
  );
  assertEquals(warnings, [{
    code: "dangerous-url-scheme",
    message:
      `Potentially dangerous URL in the "href" attribute: " \\tjava\\nscript:alert(1)". HTML escaping does not make URL schemes safe.`,
    attributeName: "href",
    value: href,
  }]);
});

Deno.test("safe URL schemes do not produce warnings", async () => {
  const warnings: RenderWarning[] = [];

  await renderToString(
    <>
      <a href="https://example.com">HTTPS</a>
      <a href="/account">Relative</a>
      <img src="data:image/png;base64,iVBORw0KGgo=" />
    </>,
    { onWarning: (warning) => warnings.push(warning) },
  );

  assertEquals(warnings, []);
});

Deno.test("stream rendering reports dangerous URL warnings", async () => {
  const warnings: RenderWarning[] = [];
  const body = await readStream(renderToStream(
    <iframe src="data:text/html,<script>alert(1)</script>"></iframe>,
    { onWarning: (warning) => warnings.push(warning) },
  ));

  assertEquals(
    body,
    `<iframe src="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>`,
  );
  assertEquals(warnings.length, 1);
  assertEquals(warnings[0].code, "dangerous-url-scheme");
  assertEquals(warnings[0].attributeName, "src");
});

Deno.test("top-level renderer failures have a consistent error type", async () => {
  const view = <div>content</div>;
  const malformed = {
    ...view,
    tagName: "bad tag",
  } as unknown as Renderable;

  const error = await assertRejects(
    () => renderToString(malformed),
    RenderError,
    "Invalid HTML tag name",
  );

  assert(error.cause instanceof TypeError);
  assertEquals(error.componentStack, []);
});

Deno.test("intrinsic element errors retain source locations", async () => {
  const source = {
    fileName: "routes/account.tsx",
    lineNumber: 42,
    columnNumber: 7,
  };
  const malformed = malformInstruction(runtimeJsx("input", {}), {
    tagName: "input",
    props: { children: "not allowed" },
    source,
  });

  const error = await assertRejects(
    () => renderToString(malformed),
    RenderError,
    "at <input> (routes/account.tsx:42:7)",
  );

  assertEquals(error.element, { name: "input", source });
  assert(Object.isFrozen(error.element));
});

Deno.test("element diagnostics compose with component stacks", async () => {
  const malformed = malformInstruction(runtimeJsx("a", {}), {
    tagName: "a",
    props: { "bad name": "value" },
    source: { fileName: "link.tsx", lineNumber: 8, columnNumber: 3 },
  });

  function Navigation() {
    return malformed;
  }

  const error = await assertRejects(
    () => renderToString(<Navigation />),
    RenderError,
  );

  assertStringIncludes(error.message, "Element:\n  at <a> (link.tsx:8:3)");
  assertStringIncludes(error.message, "Component stack:");
  assertStringIncludes(error.message, "at <Navigation>");
  assert(error.cause instanceof TypeError);
});

Deno.test("raw-text errors retain their element source", async () => {
  const malformed = malformInstruction(
    runtimeJsx("script", { children: scriptJSON({}) }),
    {
      tagName: "script",
      props: { children: "not trusted" },
      source: { fileName: "document.tsx", lineNumber: 12, columnNumber: 5 },
    },
  );

  const error = await assertRejects(
    () => renderToString(malformed),
    RenderError,
    "at <script> (document.tsx:12:5)",
  );

  assertEquals(error.element?.name, "script");
});

Deno.test("void elements are validated before their attributes", async () => {
  const malformed = malformInstruction(runtimeJsx("input", {}), {
    tagName: "input",
    props: {
      children: "not allowed",
      "bad name": "not serialized",
    },
  });

  await assertRejects(
    () => renderToString(malformed),
    RenderError,
    "Void element <input> cannot have children",
  );
});

Deno.test("unknown HTML instructions fail explicitly", async () => {
  const malformed = malformInstruction(runtimeJsx("div", {}), {
    nodeType: "future-node-type",
  });

  await assertRejects(
    () => renderToString(malformed),
    RenderError,
    "Received an unknown HTML instruction",
  );
});

Deno.test("globally registered symbols cannot forge HTML instructions", async () => {
  const forged = {
    [Symbol.for("@bastianplsfix/html.node")]: true,
    nodeType: "raw",
    value: "<script>not trusted</script>",
  } as unknown as Renderable;

  await assertRejects(
    () => renderToString(forged),
    RenderError,
    "Cannot render an object as a child",
  );
});

Deno.test("malformed branded instructions fail before trusted output", async () => {
  function Component() {
    return "safe";
  }

  const malformed = [
    malformInstruction(unsafeHTML("safe"), { value: { unsafe: true } }),
    malformInstruction(runtimeJsx("div", {}), { props: null }),
    malformInstruction(runtimeJsx("div", {}), { props: new Date(0) }),
    malformInstruction(runtimeJsx(Component, {}), {
      component: "not a function",
    }),
    malformInstruction(runtimeJsxTemplate(["<p>", "</p>"], "safe"), {
      strings: ["<p>"],
    }),
  ];

  for (const instruction of malformed) {
    await assertRejects(
      () => renderToString(instruction),
      RenderError,
      "Received a malformed",
    );
  }

  const reader = renderToStream(malformed[0]).getReader();
  await assertRejects(
    () => reader.read(),
    RenderError,
    "Received a malformed raw HTML instruction",
  );
});

Deno.test("an abort signal stops buffered rendering", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("Request ended", "AbortError"));

  await assertRejects(
    () => renderToString(<p>never rendered</p>, { signal: controller.signal }),
    DOMException,
    "Request ended",
  );
});

Deno.test("an abort reason is preserved inside a component", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");

  function AbortDuringRender() {
    controller.abort(reason);
    return <p>never rendered</p>;
  }

  const error = await assertRejects(
    () => renderToString(<AbortDuringRender />, { signal: controller.signal }),
    DOMException,
    "Request ended",
  );

  assertEquals(error, reason);
});

Deno.test("aborting iterable rendering closes the iterator", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");
  let cleanedUp = false;

  async function* children(): AsyncIterable<Renderable> {
    try {
      yield "before";
      controller.abort(reason);
      yield "after";
    } finally {
      cleanedUp = true;
    }
  }

  const error = await assertRejects(
    () => renderToString(children(), { signal: controller.signal }),
    DOMException,
    "Request ended",
  );

  assertEquals(error, reason);
  assert(cleanedUp);
});

Deno.test("render failures close async iterators", async () => {
  let cleanedUp = false;

  async function* children(): AsyncIterable<Renderable> {
    try {
      yield "before";
      yield { invalid: true } as unknown as Renderable;
      yield "after";
    } finally {
      cleanedUp = true;
    }
  }

  await assertRejects(
    () => renderToString(children()),
    RenderError,
    "Cannot render an object as a child",
  );

  assert(cleanedUp);
});

Deno.test("render failures close synchronous iterators", async () => {
  let cleanedUp = false;

  function* children(): Iterable<Renderable> {
    try {
      yield "before";
      yield { invalid: true } as unknown as Renderable;
      yield "after";
    } finally {
      cleanedUp = true;
    }
  }

  await assertRejects(
    () => renderToString(children()),
    RenderError,
    "Cannot render an object as a child",
  );

  assert(cleanedUp);
});

Deno.test("iterator cleanup errors do not hide render failures", async () => {
  const primaryError = new Error("render failed");
  const iterable: Iterable<Renderable> = {
    [Symbol.iterator]() {
      return {
        next() {
          return { done: false, value: Promise.reject(primaryError) };
        },
        return() {
          throw new Error("cleanup failed");
        },
      };
    },
  };

  const error = await assertRejects(
    () => renderToString(iterable),
    RenderError,
    "render failed",
  );

  assertEquals(error.cause, primaryError);
});

Deno.test("HTML instruction objects are immutable", () => {
  const view = <div>content</div>;
  assert(Object.isFrozen(view));
  assertEquals(Object.getOwnPropertySymbols({ ...view }), []);
});
