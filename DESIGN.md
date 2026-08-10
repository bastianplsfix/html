# `@bastianplsfix/html` design

Status: accepted direction; buffered and ordered streaming renderers implemented
in the current source.

## Product thesis

`@bastianplsfix/html` is a Deno-first, server-only TSX framework for producing
HTML. It uses TypeScript and Deno's JSX precompile transform instead of
inventing a template-file syntax.

```text
TSX
  ↓
immutable Html value
  ↓
renderToString() or renderToStream()
  ↓
Response
```

The framework has:

- no virtual DOM;
- no reconciliation;
- no hooks;
- no hydration;
- no client-side runtime;
- no router or application-framework conventions.

Deno is particularly well suited to this shape. It executes `.tsx` files
directly, supports custom JSX runtimes through `jsxImportSource`, and provides a
server-oriented `precompile` transform with a framework-independent runtime
contract.

The renderer sits on standard `Request`, `Response`, and `ReadableStream` APIs.
It can therefore be used with `Deno.serve`, `deno serve`, Hectoday HTTP, Hono,
Oak, or without an HTTP framework.

## Consumer configuration

Once the package is published, a consumer can configure Deno like this:

```json
{
  "compilerOptions": {
    "jsx": "precompile",
    "jsxImportSource": "@bastianplsfix/html",
    "jsxPrecompileSkipElements": ["script", "style"]
  },
  "imports": {
    "@bastianplsfix/html": "jsr:@bastianplsfix/html@^0.2.0"
  },
  "lint": {
    "rules": {
      "exclude": ["jsx-key"]
    }
  }
}
```

Skipping `script` and `style` leaves those raw-text elements for the runtime.
This setting is required for the runtime to enforce their context-specific child
rules; plain values are rejected and callers must use `scriptJSON()` or an
explicit trusted raw instruction.

Deno's `jsx-key` lint rule targets reconciling UI renderers. It should be
disabled for this runtime because server component lists have no identity or
reconciliation semantics.

## Intended usage

### Layouts

```tsx
import { type Children, doctype } from "@bastianplsfix/html";

type LayoutProps = {
  title: string;
  children: Children;
};

export function Layout({ title, children }: LayoutProps) {
  return (
    <>
      {doctype()}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>{title}</title>
          <link rel="stylesheet" href="/app.css" />
        </head>
        <body>
          <header>
            <a href="/">My application</a>
          </header>
          <main>{children}</main>
        </body>
      </html>
    </>
  );
}
```

Attributes use HTML terminology:

```tsx
<label for="email">
<div class="card">
<input readonly>
```

React-specific aliases such as `htmlFor` and `className` are not the documented
style. Migration aliases may be considered separately, but they must not define
the native API.

### Components are ordinary functions

```tsx
type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

export function TodoList({ todos }: { todos: readonly Todo[] }) {
  if (todos.length === 0) {
    return <p>You have nothing to do.</p>;
  }

  return (
    <ul>
      {todos.map((todo) => (
        <li>
          <a href={`/todos/${todo.id}`}>
            {todo.completed ? "✓ " : ""}
            {todo.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
```

There is no custom loop syntax, conditional directive, or template language.
TypeScript already supplies control flow.

### Deno server boundary

```tsx
import { renderToString } from "@bastianplsfix/html";
import { Layout } from "./views/layout.tsx";
import { TodoList } from "./views/todo-list.tsx";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    const todos = [{
      id: "1",
      title: "Build a templating engine",
      completed: false,
    }];

    const view = (
      <Layout title="Todos">
        <h1>Todos</h1>
        <TodoList todos={todos} />
      </Layout>
    );

    const body = await renderToString(view);

    return new Response(body, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
} satisfies Deno.ServeDefaultExport;
```

The boundary is intentionally visible:

```tsx
const view = <Layout>...</Layout>;
const body = await renderToString(view);
return new Response(body, init);
```

The renderer describes HTML. The route decides what that HTML means over HTTP.

## Public value model

The two central public types are conceptually:

```ts
export interface Html {
  readonly [privateBrand]: true;
}

export type Renderable =
  | Html
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Iterable<Renderable>
  | AsyncIterable<Renderable>
  | PromiseLike<Renderable>;
```

A component is a function whose invocation is deferred until rendering:

```ts
export type Component<Props = Record<never, never>> = (
  props: Props & { readonly children?: Renderable },
) => Renderable;
```

This supports synchronous and asynchronous components without component classes,
lifecycle methods, or a scheduler.

## Rendering semantics

The core contract is deliberately small:

| Value                         | Rendering behavior                       |
| ----------------------------- | ---------------------------------------- |
| `string`, `number`, `bigint`  | Escape and render as text                |
| Branded `Html`                | Render as trusted framework instructions |
| `null`, `undefined`, booleans | Render nothing                           |
| Array or iterable             | Flatten recursively                      |
| Promise                       | Await and render the result              |
| Async iterable                | Consume in order                         |
| Arbitrary object or function  | Throw a descriptive error                |

Unsupported objects must never silently become `[object Object]`.

A component returning a string still produces escaped text:

```tsx
function Message() {
  return "<strong>Not actually strong</strong>";
}
```

Output:

```html
&lt;strong&gt;Not actually strong&lt;/strong&gt;
```

Only branded `Html` instructions can bypass text escaping.

## Async components

Async components remain ordinary functions:

```tsx
async function UserBadge({ userId }: { userId: string }) {
  const user = await findUser(userId);

  if (!user) {
    return <span>Unknown user</span>;
  }

  return <a href={`/users/${user.id}`}>{user.name}</a>;
}
```

The JSX runtime does not execute `UserBadge`. It creates an immutable component
instruction containing the function and props. The renderer invokes it later.
This allows rendering options such as an abort signal to flow through traversal
and lets buffered and streaming entrypoints share the same ordered traversal.

## Buffered and streaming output

The core API is:

```ts
export function renderToString(
  view: Renderable,
  options?: RenderOptions,
): Promise<string>;

export function renderToStream(
  view: Renderable,
  options?: RenderOptions,
): ReadableStream<Uint8Array>;

export interface RenderOptions {
  readonly signal?: AbortSignal;
  readonly onWarning?: (warning: RenderWarning) => void;
}

export function doctype(): Html;
export function unsafeHTML(value: string): Html;
export function scriptJSON(value: unknown): Html;
```

Buffered rendering remains the default:

```tsx
const body = await renderToString(<Page />);
return new Response(body, init);
```

Buffering lets an application catch every rendering error before committing an
HTTP response, then choose an error page and status code.

Streaming is explicit:

```tsx
const body = renderToStream(<Page />, { signal: request.signal });

return new Response(body, {
  headers: { "content-type": "text/html; charset=utf-8" },
});
```

The streaming model is ordered and unsurprising:

```text
render prefix
await next value
render it
continue
```

The stream emits UTF-8 chunks and advances traversal only as the consumer pulls,
so normal `ReadableStream` backpressure controls renderer progress. Promises and
async iterables still resolve in document order; there is no Suspense-style or
out-of-order completion model.

Cancelling the stream or aborting `options.signal` stops traversal and attempts
to call `return()` on active iterators. Cancellation is cooperative: the
renderer stops awaiting a pending promise, but cannot stop the underlying work
unless that work observes the application signal itself. Signal aborts preserve
the exact abort reason and remain prompt while uncooperative cleanup finishes in
the background. `reader.cancel()` waits for asynchronous iterator cleanup, so a
`return()` that never settles also leaves cancellation pending. Cleanup failures
never replace the primary render, abort, or cancellation failure. Once the first
bytes are sent, the application cannot replace the response with another HTTP
status, and later rendering failures surface as stream errors. That tradeoff
stays explicit.

## Optional Response adapter

The core renderer remains HTTP-independent. The `/response` entrypoint offers a
small convenience:

```tsx
import { html, streamHtml } from "@bastianplsfix/html/response";

return await html(<HomePage />);

return streamHtml(<HomePage />, { signal: request.signal });
```

`html()` renders to a string; `streamHtml()` preserves streaming. Both accept
`HtmlResponseInit`, which combines `ResponseInit` with the renderer's signal and
warning callback, and set `text/html; charset=utf-8` only when the caller did
not supply a content type. This pairs naturally with Hectoday HTTP without
coupling the renderer to it.

## Security invariants

Security is the defining feature:

> User values are text unless explicitly marked as trusted HTML.

### Text escaping

```tsx
const query = `<script>alert("hello")</script>`;
const view = <p>{query}</p>;
```

Output:

```html
<p>&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;</p>
```

### Attribute escaping

```tsx
const name = `" onmouseover="alert(1)`;
const view = <input value={name} />;
```

Output:

```html
<input value="&quot; onmouseover=&quot;alert(1)">
```

### Explicit unsafe HTML

```tsx
const renderedMarkdown = markdownToHTML(source);

return <article>{unsafeHTML(renderedMarkdown)}</article>;
```

The name is intentionally uncomfortable. `raw` would make bypassing escaping
sound routine; `unsafeHTML` makes the trust boundary visible at the callsite.

### Embedded JSON

JSON embedded in a script raw-text element uses a dedicated helper:

```tsx
<script type="application/json" id="initial-data">
  {scriptJSON(data)}
</script>;
```

`scriptJSON` serializes JSON and replaces `<`, `>`, `&`, U+2028, and U+2029 with
JavaScript Unicode escapes. Ordinary HTML escaping does not model every raw-text
context correctly.

### URLs

HTML escaping does not make a URL semantically safe:

```tsx
<a href={userInput}>Open</a>;
```

A `javascript:` URL can be correctly HTML-escaped and remain dangerous. The
renderer does not rewrite it, but an optional `onWarning` callback receives an
immutable diagnostic for dangerous dynamic `javascript:` and `vbscript:` URL
schemes, including browser-normalized control-character variants:

```tsx
const body = await renderToString(view, {
  onWarning(warning) {
    console.warn(warning.message);
  },
});
```

The callback is a development diagnostic, not a sanitizer. An application may
throw from it to fail rendering, but it must still define and enforce its own
URL allowlist.

### Executable attribute contexts

Dynamic attribute names beginning with `on` are rejected case-insensitively.
Although quoting prevents an attribute breakout, browsers decode and execute an
inline event-handler value as JavaScript. Dynamic `srcdoc` is also rejected
because browsers decode the attribute and parse the result as a new HTML
document. Deliberate trusted markup remains possible through the visibly unsafe
`unsafeHTML()` boundary.

### Raw-text elements

Plain strings and ordinary renderable instructions are rejected inside
`<script>` and `<style>`. Raw-text parsing does not follow ordinary HTML text
escaping rules, so accepted children must resolve to explicitly trusted raw
instructions:

```tsx
<script type="application/json">{scriptJSON(data)}</script>
<style>{unsafeHTML(trustedStylesheet)}</style>
```

`scriptJSON()` is the narrow helper for JSON data. `unsafeHTML()` performs no
sanitization and is also unsafe in JavaScript and CSS contexts; its input must
already be trusted for the specific raw-text language. This enforcement depends
on keeping `script` and `style` in `jsxPrecompileSkipElements`.

## Attribute behavior

Intrinsic elements use server-oriented serialization:

```tsx
<input
  disabled={true}
  required={false}
  value={value}
  data-user-id={user.id}
/>;
```

The rules are:

- `null`, `undefined`, and `false` omit the attribute;
- `true` emits a bare attribute;
- strings, numbers, and bigints emit escaped quoted values;
- functions, symbols, and objects throw;
- spread attribute names and values are validated before serialization;
- `data-*` and `aria-*` are supported;
- custom elements such as `<user-avatar>` are supported;
- function-valued client event props are type errors;
- emitted `on*` attributes are rejected at runtime, including spread props;
- emitted `srcdoc` is rejected because it creates a nested HTML context;
- `ref` is rejected because it has no server-only meaning.

For 0.1, `class` and `style` remain strings:

```tsx
<div class={classes("card", active && "active")} />
<div style="display: grid; gap: 1rem" />
```

A `classes()` helper may be added without teaching the serializer broad object
semantics.

## JSX runtime contract

Deno's precompile transform expects a custom runtime to expose `jsxTemplate`,
`jsxAttr`, `jsxEscape`, and `jsx`. It compiles static HTML into string arrays
and inserts dynamic values through those helpers.

The package entrypoints are:

```text
@bastianplsfix/html
@bastianplsfix/html/jsx-runtime
@bastianplsfix/html/jsx-dev-runtime
@bastianplsfix/html/response
```

Conceptually, the runtime does this:

```ts
export function jsxTemplate(
  strings: readonly string[],
  ...values: readonly unknown[]
): Html {
  return templateNode(strings, values);
}

export function jsxEscape(value: unknown): Html {
  return escapedTextNode(value);
}

export function jsxAttr(name: string, value: unknown): Html {
  return attributeNode(name, value);
}

export function jsx(
  type: string | Component,
  props: Record<string, unknown> | null,
): Html {
  return typeof type === "function"
    ? componentNode(type, props ?? {})
    : elementNode(type, props ?? {});
}
```

It also provides `Fragment`, `jsxs`, and `jsxDEV`. The development entrypoint
retains source metadata when the invoking JSX transform supplies it. Deno's
`react-jsxdev` mode supplies file, line, and column details; the optimized
`precompile` transform currently does not. Component names remain available in
both modes.

Diagnostics should ultimately look like:

```text
Cannot render an object as a child.

Received: {"id":"123"}

Component stack:
  at <TodoRow> (views/todo-row.tsx:18:11)
```

## Internal representation

`Html` is not a string. It brands a small immutable instruction union:

```ts
type HtmlNode =
  | TemplateNode
  | ComponentNode
  | ElementNode
  | EscapedNode
  | AttributeNode
  | RawNode
  | FragmentNode;
```

For example:

```tsx
<div class="greeting">
  Hello {name}
  <UserBadge userId={id} />
</div>;
```

Conceptually becomes:

```text
TemplateNode {
  strings: [
    '<div class="greeting">Hello ',
    '',
    '</div>',
  ],
  values: [
    EscapedNode(name),
    ComponentNode(UserBadge, { userId: id }),
  ],
}
```

This retains the performance benefit of compiler-produced static strings while
avoiding a commitment to synchronous concatenation. The renderer performs one
ordered traversal:

```text
static string → append
escaped value → resolve and escape
attribute → serialize in attribute context
component → invoke and render its result
promise → await
iterable → flatten
raw value → append without escaping
```

Fully synchronous templates may gain a fast join path later. Public semantics
must not depend on that optimization.

## TypeScript model

The framework does not reuse React's JSX types. React types expose concepts that
do not belong in a server-only renderer:

- client event-handler functions;
- refs;
- hydration properties;
- React-specific attribute aliases;
- component lifecycle assumptions.

The package instead owns HTML and SVG JSX types that prefer native names:

```tsx
<a href="/account" target="_blank">
<input type="email" autocomplete="email">
<meta http-equiv="refresh" content="30">
<svg viewBox="0 0 24 24">
```

The types permit `data-*`, `aria-*`, and hyphenated custom elements, while
rejecting obvious per-element mistakes:

```tsx
<img href="/image.png" />
<input href="/account" />
<button onClick={() => {}} />
```

Perfect coverage of every living-standard attribute is not required for the
prototype. The type model must remain server-native as coverage grows.

## Deliberate non-goals

The following remain outside the core:

- routing;
- filesystem conventions;
- middleware;
- data-loading conventions;
- sessions and authentication;
- CSS processing;
- asset fingerprinting;
- client bundling;
- hydration;
- state and hooks;
- islands;
- HTTP status codes and redirects.

A page component cannot secretly mutate an HTTP response. It returns HTML; the
request handler returns a `Response`.

Fresh already provides a complete server-rendered application framework using
Preact and islands. This project should not recreate that layer.

## Why TSX instead of a tagged or custom template

A tagged template can be pleasant for small fragments and may be offered later:

```ts
const page = html`
  <main>
    <h1>Hello ${name}</h1>
  </main>
`;
```

It is not the primary interface. TSX provides:

- composable function components;
- normal TypeScript control flow;
- typed component props;
- editor understanding of nested structures;
- Deno's precompile optimization;
- no custom parser;
- no new template language.

A `.html` or `.dhtml` format would require a parser, language-server support,
source maps, formatting, syntax highlighting, and a build pipeline. That moves
away from Deno's strongest property: executable TypeScript with little tooling.

## Differentiators

Synchronous JSX-to-string conversion is not enough; Deno already has SSR options
through Preact, Hono, and Fresh. The product thesis rests on:

1. **Deno precompile first.** The instruction model is designed around Deno's
   transform rather than adapted from a browser UI library.
2. **Server-only semantics.** HTML components have no VDOM, hooks, events, or
   hydration vocabulary.
3. **Security-first values.** Plain strings are always escaped; only branded
   framework values are trusted.
4. **Async-native architecture.** Promises and async iterables are part of the
   value model.
5. **Web Standard boundaries.** Rendered strings and streams compose with
   `Response`; HTTP policy remains with the application.
6. **Strict native types.** HTML names are preferred and function-valued client
   events are absent.
7. **Excellent diagnostics.** Rendering failures retain component and, when
   available, source context.

## Release plan

### 0.1 foundation

- [x] Deno precompile runtime;
- [x] immutable branded `Html` instructions;
- [x] deferred function components;
- [x] fragments, arrays, and iterables;
- [x] promises and buffered async rendering;
- [x] `renderToString()`;
- [x] text and attribute escaping;
- [x] boolean attributes;
- [x] void-element serialization;
- [x] `unsafeHTML()` and `doctype()`;
- [x] HTML-native JSX type foundation;
- [x] component-aware render errors;
- [x] `AbortSignal` checks;
- [x] `scriptJSON()`;
- [x] optional buffered response adapter.

These items define the original buffered foundation. Streaming and the stricter
security work below build on the same value semantics.

### Follow-up work

- [x] `renderToStream()` with ordered UTF-8 output;
- [x] streaming backpressure tests;
- [x] abort-aware iterator cleanup;
- [x] adversarial thenable and iterator protocol tests;
- [x] pending-operation and cancellation race tests;
- [x] Unicode property and large-payload escaping tests;
- [x] WHATWG HTML parser conformance tests;
- [ ] richer development source locations under precompile;
- [x] source-aware component diagnostics under `react-jsxdev`;
- [x] development warnings for dangerous URL schemes;
- [x] dynamic inline-event and `srcdoc` rejection;
- [x] stricter `script` and `style` raw-text policies;
- [x] broader HTML and SVG tag coverage checked against Deno's TypeScript DOM
      maps;
- [x] explicit inline SVG coverage with serialized attribute names;
- [x] serializable custom-element attribute refinements;
- [x] baseline buffered and streaming benchmarks;
- [x] detailed time-to-first-byte, memory, chunk, slow-consumer, and
      cancellation profiling;
- [ ] synchronous fast paths.

## Contract-defining test

The first invariant is interpolated text escaping:

```tsx
import { assertEquals } from "@std/assert";
import { renderToString } from "@bastianplsfix/html";

Deno.test("interpolated strings are escaped", async () => {
  const attack = `<script>alert("hello")</script>`;

  const result = await renderToString(<p>{attack}</p>);

  assertEquals(
    result,
    `<p>&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;</p>`,
  );
});
```

## Product pitch

> **Typed TSX templates for Deno. No virtual DOM, no hydration, no client
> runtime—just safe HTML strings and streams.**

## References

- [JSX and React — Deno documentation](https://docs.deno.com/runtime/reference/jsx/)
- [Writing an HTTP server — Deno documentation](https://docs.deno.com/runtime/fundamentals/http_server/)
- [Deno 1.38: JSX precompile transform](https://deno.com/blog/v1.38)
- [Fresh documentation](https://fresh.deno.dev/docs)
- [Publishing packages — JSR documentation](https://jsr.io/docs/publishing-packages)
