# `@bastianplsfix/html`

Typed, server-only TSX templates for Deno. No virtual DOM, hydration, hooks, or
client runtime—just safe HTML values rendered to strings.

The package is in its initial 0.1 implementation phase. See
[DESIGN.md](./DESIGN.md) for the full architecture and roadmap.

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
