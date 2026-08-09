# `@bastianplsfix/html`

Typed, server-only TSX templates for Deno. No virtual DOM, hydration, hooks, or
client runtime—just safe HTML values rendered to strings.

[Documentation](https://bastianplsfix-html.bs.deno.net) ·
[JSR](https://jsr.io/@bastianplsfix/html) · [Design](./DESIGN.md)

The `0.x` API is usable but still evolving. Rendering and escaping semantics are
treated as compatibility contracts; new public capabilities land in minor
releases.

## Install

```sh
deno add jsr:@bastianplsfix/html@^0.1.0
```

## Configure Deno

```json
{
  "compilerOptions": {
    "jsx": "precompile",
    "jsxImportSource": "@bastianplsfix/html",
    "jsxPrecompileSkipElements": ["script", "style"]
  },
  "imports": {
    "@bastianplsfix/html": "jsr:@bastianplsfix/html@^0.1.0"
  }
}
```

## Render a view

```tsx
import { type Children, doctype, renderToString } from "@bastianplsfix/html";

function Layout(
  { title, children }: { title: string; children: Children },
) {
  return (
    <>
      {doctype()}
      <html lang="en">
        <head>
          <title>{title}</title>
        </head>
        <body>{children}</body>
      </html>
    </>
  );
}

const body = await renderToString(
  <Layout title="Hello">
    <h1>Hello from Deno</h1>
  </Layout>,
);

const response = new Response(body, {
  headers: { "content-type": "text/html; charset=utf-8" },
});
```

Plain strings are always escaped. Bypassing escaping requires an explicit
`unsafeHTML(trustedMarkup)` call. Use `scriptJSON(value)` for JSON embedded in a
`<script>` raw-text element.

See the [security model](https://bastianplsfix-html.bs.deno.net/security) for
the trust boundary and context-specific guidance.

## Response helper

```tsx
import { html } from "@bastianplsfix/html/response";

return await html(<h1>Hello</h1>, { status: 200 });
```

## Development

```sh
deno task check
```

The documentation site is built with this package and contains no client-side
runtime:

```sh
deno task docs
```

Then open <http://localhost:8000>.

## Scope

This project renders HTML. Routing, middleware, sessions, asset pipelines,
hydration, browser state, and client bundling deliberately remain outside the
core package.

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
before opening a change and report vulnerabilities according to
[SECURITY.md](./SECURITY.md).
