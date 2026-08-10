# `@bastianplsfix/html`

Typed, server-only TSX templates for Deno. No virtual DOM, hydration, hooks, or
client runtime—just safe HTML values rendered to strings or streams.

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

For ordered incremental delivery, pass a stream directly to `Response`:

```tsx
import { renderToStream } from "@bastianplsfix/html";

const body = renderToStream(<Layout title="Hello">...</Layout>, {
  signal: request.signal,
});

return new Response(body, {
  headers: { "content-type": "text/html; charset=utf-8" },
});
```

Stream chunk boundaries are unspecified. Rendering errors after the response
starts cannot replace the already-committed HTTP status or headers.

Plain strings are always escaped. Bypassing escaping requires an explicit
`unsafeHTML(trustedMarkup)` call. Use `scriptJSON(value)` for JSON embedded in a
`<script>` raw-text element. Ordinary children of `<script>` and
`<style>` are rejected because HTML text escaping is not safe in those parsing
contexts; trusted JavaScript or CSS source must use `unsafeHTML()` explicitly.
Trusted instructions use a module-private brand and are shape-validated before
the renderer consumes raw content.

Escaping also does not make a URL scheme safe. Supply `onWarning` during
development to receive structured diagnostics for dangerous values in URL
attributes:

```tsx
await renderToString(view, {
  onWarning: (warning) => console.warn(warning.message),
});
```

In development builds, intrinsic-element failures include the filename, line,
and column supplied by the JSX development runtime, alongside the component
stack.

Inline SVG uses native serialized attribute names rather than DOM property
aliases:

```tsx
<svg viewBox="0 0 24 24">
  <path d="M3 12h18" stroke-linecap="round" stroke-width={2} />
</svg>
```

Custom elements accept global HTML attributes, `data-*`/`aria-*` values, and
hyphenated application attributes. Attribute values must still serialize as
scalars at render time because the server renderer does not serialize client
behavior:

```tsx
<user-avatar user-id="123" data-state="ready">Profile</user-avatar>
```

## Response helpers

```tsx
import { html, streamHtml } from "@bastianplsfix/html/response";

// Buffer first, so rendering can fail before the Response is created.
return await html(<h1>Hello</h1>, { status: 200 });

// Or begin sending ordered HTML as it is rendered.
return streamHtml(<h1>Hello</h1>, {
  status: 200,
  signal: request.signal,
});
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
