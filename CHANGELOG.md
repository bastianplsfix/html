# Changelog

All notable changes to `@bastianplsfix/html` are documented here. The project
uses semantic versioning while its public API is still evolving below `1.0.0`.

## 0.2.0 — 2026-08-10

### Added

- Ordered, backpressure-aware `renderToStream()` output with UTF-8 encoding,
  cancellation, abort propagation, and async-iterator cleanup.
- Optional dangerous-URL diagnostics through `RenderOptions.onWarning`.
- Source-aware component and intrinsic-element errors under the `react-jsxdev`
  transform.
- Broader HTML and inline SVG typings checked against Deno's TypeScript DOM tag
  maps, with serialized native attribute names.
- Release automation, a published-package consumer example, production smoke
  checks, contributor and security policies, and a rendering benchmark suite.
- Buffered and streaming response helpers that forward abort signals and URL
  diagnostics without coupling the renderer core to HTTP.
- Deterministic offline HTML, SVG, and ARIA type generation from pinned,
  integrity-checked source snapshots, including generated-file drift checks.
- Adversarial protocol, cancellation-race, arbitrary-Unicode, large-payload, and
  WHATWG parser-conformance coverage.

### Security

- Reject dynamic inline event-handler and `srcdoc` attributes at runtime.
- Require explicitly trusted raw instructions inside `script` and `style`.
- Reject control characters in dynamic attribute names.
- Report stable `scriptJSON()` errors for cycles, bigints, and failing
  serializers while preserving their original causes.
- Validate user-controlled thenable and iterator protocols, reject malformed
  results, detect resolution cycles, and preserve primary failures through
  iterator cleanup.
- Keep the internal trusted-HTML brand module-private and validate every branded
  instruction shape before emitting output.

### Changed

- Attribute and raw-text failures now include component or element context in
  `RenderError` diagnostics.
- Custom-element attributes are constrained to serializable server values.
- SVG types use serialized names such as `stroke-linecap` instead of React
  aliases such as `strokeLinecap`.
- Buffered rendering now uses a bounded synchronous continuation path, and
  streaming coalesces small segments while flushing before unresolved work.
  These internal fast paths keep the public asynchronous API unchanged.
- Cancellation is explicitly cooperative: signal aborts remain prompt, while
  reader cancellation waits for finite iterator cleanup.

## 0.1.0 — 2026-08-09

- Initial server-only TSX runtime, immutable HTML instructions, deferred sync
  and async function components, buffered rendering, context-aware escaping,
  trust helpers, HTML-native JSX types, and a Web Standard response adapter.
