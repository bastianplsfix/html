import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  doctype,
  type Renderable,
  RenderError,
  renderToString,
  scriptJSON,
  unsafeHTML,
} from "@bastianplsfix/html";

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

Deno.test("spread attributes are validated at render time", async () => {
  const attributes = { "bad name": "surprise" };
  const view = <div {...attributes}>content</div>;

  await assertRejects(
    () => renderToString(view),
    TypeError,
    "Invalid HTML attribute name",
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

Deno.test("HTML instruction objects are immutable", () => {
  const view = <div>content</div>;
  assert(Object.isFrozen(view));
});
