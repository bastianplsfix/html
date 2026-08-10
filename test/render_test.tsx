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
  renderToStream,
  renderToString,
  scriptJSON,
  unsafeHTML,
} from "@bastianplsfix/html";
import {
  jsx as runtimeJsx,
  jsxTemplate as runtimeJsxTemplate,
} from "../jsx-runtime.ts";
import { rawNode as copiedRawNode } from "../src/model.ts?copy=runtime";

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

Deno.test("boolean-like enumerated attributes serialize explicit tokens", async () => {
  assertEquals(
    await renderToString(
      <div
        contenteditable={false}
        draggable
        spellcheck={false}
        writingsuggestions
      />,
    ),
    '<div contenteditable="false" draggable="true" spellcheck="false" writingsuggestions="true"></div>',
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

Deno.test("unsupported objects throw instead of stringifying implicitly", async () => {
  const value = { id: "123" } as unknown as Renderable;

  const error = await assertRejects(
    () => renderToString(<p>{value}</p>),
    RenderError,
  );

  assertStringIncludes(error.message, "Cannot render an object as a child");
  assertStringIncludes(error.message, "Received: [Object]");
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

Deno.test("spread attributes are validated at render time", async () => {
  const attributes = { "bad name": "surprise" };
  const view = <div {...attributes}>content</div>;

  await assertRejects(
    () => renderToString(view),
    RenderError,
    "Invalid HTML attribute name",
  );
});

Deno.test("the shared protocol brand does not admit malformed instructions", async () => {
  const forged = {
    [Symbol.for("@bastianplsfix/html.node")]: true,
    nodeType: "raw",
    value: { markup: "<script>not trusted</script>" },
  } as unknown as Renderable;

  await assertRejects(
    () => renderToString(forged),
    RenderError,
    "Received a malformed raw HTML instruction",
  );
});

Deno.test("the v1 protocol composes across independent copies", async () => {
  assertEquals(
    await renderToString(copiedRawNode("<i>independent 0.2 copy</i>")),
    "<i>independent 0.2 copy</i>",
  );
});

Deno.test("malformed branded instructions fail before trusted output", async () => {
  function Component() {
    return "safe";
  }

  const malformed = [
    malformInstruction(unsafeHTML("safe"), { value: { unsafe: true } }),
    malformInstruction(runtimeJsx("div", {}), { props: null }),
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
});

Deno.test("element diagnostics are structured and compose with components", async () => {
  const source = {
    fileName: "views/link.tsx",
    lineNumber: 8,
    columnNumber: 3,
  };
  const malformed = malformInstruction(runtimeJsx("a", {}), {
    props: { "bad name": "value" },
    source,
  });

  function Navigation() {
    return malformed;
  }

  const error = await assertRejects(
    () => renderToString(<Navigation />),
    RenderError,
  );

  assertEquals(error.element, { name: "a", source });
  assert(Object.isFrozen(error.element));
  assertStringIncludes(error.message, "Element:");
  assertStringIncludes(error.message, "at <a> (views/link.tsx:8:3)");
  assertStringIncludes(error.message, "at <Navigation>");
  assert(error.cause instanceof TypeError);
});

Deno.test("void children fail before attributes or stream output", async () => {
  const malformed = malformInstruction(runtimeJsx("input", {}), {
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

  const reader = renderToStream(malformed).getReader();
  await assertRejects(
    () => reader.read(),
    RenderError,
    "Void element <input> cannot have children",
  );
});

Deno.test("buffered fast traversal observes render side effects once", async () => {
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

  async function Deferred() {
    componentCalls++;
    await Promise.resolve();
    return <a href={dangerousHref}>{values}</a>;
  }

  assertEquals(
    await renderToString(<Deferred />, {
      onWarning() {
        warningCalls++;
      },
    }),
    `<a href="javascript:alert(1)">&lt;item&gt;</a>`,
  );
  assertEquals(componentCalls, 1);
  assertEquals(iteratorGetterCalls, 1);
  assertEquals(iteratorFactoryCalls, 1);
  assertEquals(warningCalls, 1);
});

Deno.test("buffered fast traversal yields cooperatively to cancellation", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Request ended", "AbortError");
  const total = 10_000;
  let componentCalls = 0;

  function Item() {
    componentCalls++;
    return "item";
  }

  const items = Array.from({ length: total }, () => <Item />);
  queueMicrotask(() => controller.abort(reason));
  const error = await renderToString(items, { signal: controller.signal })
    .catch((failure) => failure);

  assertEquals(error, reason);
  assert(componentCalls > 0);
  assert(componentCalls < total);
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

Deno.test("HTML instruction objects are immutable", () => {
  const view = <div>content</div>;
  assert(Object.isFrozen(view));
  assertEquals(Object.getOwnPropertySymbols({ ...view }), []);
});
