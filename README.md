# `@bastianplsfix/html`

Typed, server-only TSX templates for Deno. No virtual DOM, hydration, hooks, or
client runtime—just safe HTML values rendered to strings or streams.

The compatibility floor is Deno 2.1. Use a currently maintained stable or LTS
Deno release for production deployments.

[Documentation](https://bastianplsfix-html.bs.deno.net) ·
[JSR](https://jsr.io/@bastianplsfix/html) · [Changelog](./CHANGELOG.md) ·
[Design](./DESIGN.md) · [Third-party notices](./THIRD_PARTY_NOTICES.md)

The `0.x` API is usable but still evolving. Rendering and escaping semantics are
treated as compatibility contracts; new public capabilities land in minor
releases.

## Install

```sh
deno add jsr:@bastianplsfix/html@^0.2.0
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
    "@bastianplsfix/html": "jsr:@bastianplsfix/html@^0.2.0"
  },
  "lint": {
    "rules": {
      "exclude": ["jsx-key"]
    }
  }
}
```

The renderer has no reconciliation, so JSX keys have no meaning. Excluding
Deno's client-oriented `jsx-key` lint rule keeps mapped server components free
of false warnings.

> **Important:** `jsxPrecompileSkipElements` is security-critical. Keep both
> `script` and `style` in the list: otherwise Deno may compile their contents
> into static template strings before normal raw-text child validation. The
> renderer rejects that precompiled shape defensively, but it cannot render the
> element until the required skip configuration is restored.

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
`<script>` raw-text element. Plain children are rejected inside `<script>` and
`<style>`; use a context-appropriate trusted helper instead. Dynamic `on*` and
`srcdoc` attributes are also rejected because HTML attribute escaping cannot
make their executable contexts safe.

See the [security model](https://bastianplsfix-html.bs.deno.net/security) for
the trust boundary and context-specific guidance.

Compatible copies of the package share the version-one `Html` instruction
protocol, so trusted component libraries can return `Html` even when Deno
resolves a separate compatible package copy. Unknown protocols and malformed
instructions are rejected. The brand prevents accidental value confusion; it is
not a security boundary against hostile code already executing in the process.

URL escaping is intentionally separate from URL policy. Both renderers can
report dangerous dynamic schemes without rewriting output:

```tsx
const body = await renderToString(view, {
  onWarning(warning) {
    console.warn(warning.message);
  },
});
```

Use the callback for development diagnostics, or throw from it when the
application wants warnings to fail rendering. Applications must still validate
allowed schemes and destinations.

Native presence attributes use the usual server semantics: `true` emits the bare
attribute and `false` omits it. Enumerated boolean-like attributes—
`contenteditable`, `draggable`, `spellcheck`, and `writingsuggestions`—instead
serialize booleans as the quoted tokens `"true"` and `"false"`, because a
present `false` token is meaningfully different from an omitted attribute.

## Stream a view

```tsx
import { renderToStream } from "@bastianplsfix/html";

const body = renderToStream(<Page />, {
  signal: request.signal,
});

return new Response(body, {
  headers: { "content-type": "text/html; charset=utf-8" },
});
```

Streaming emits ordered UTF-8 chunks and advances traversal in response to
consumer demand. Cancelling the stream or aborting its signal stops traversal
and attempts to close active iterators. Cancellation is cooperative: the
renderer can stop awaiting a pending promise, but the underlying operation must
observe the same signal to stop its own work. Signal aborts stay prompt;
`reader.cancel()` waits for finite iterator cleanup and can remain pending when
an iterator's `return()` never settles. It does not render unresolved components
out of order. Once response bytes have been sent, later rendering failures
cannot change the HTTP status; use `renderToString()` when preflight error
handling matters more than progressive output.

## Response helper

```tsx
import { html, streamHtml } from "@bastianplsfix/html/response";

return await html(<h1>Hello</h1>, { status: 200 });

// Or preserve streaming and pass renderer options alongside ResponseInit.
return streamHtml(<Page />, { signal: request.signal });
```

## Development

```sh
deno task check
deno task bench:check
deno task bench:profile
```

The documentation site is built with this package and contains no client-side
runtime:

```sh
deno task docs
```

Then open <http://localhost:8000>.

The optimized `precompile` JSX transform does not currently supply source
locations to the runtime. For development builds that need file and line details
in component stacks, use `"jsx": "react-jsxdev"` with the same
`jsxImportSource`. Component names are retained under either transform.

## Scope

This project renders HTML. Routing, middleware, sessions, asset pipelines,
hydration, browser state, and client bundling deliberately remain outside the
core package.

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
before opening a change and report vulnerabilities according to
[SECURITY.md](./SECURITY.md). Maintainers should follow the verified
[release checklist](./RELEASING.md).
