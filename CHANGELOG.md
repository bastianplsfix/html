# Changelog

All notable changes to `@bastianplsfix/html` are documented here. The project
uses semantic versioning while its public API is still evolving below `1.0.0`.

## 0.2.0 — 2026-08-09

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

### Security

- Reject dynamic inline event-handler and `srcdoc` attributes at runtime.
- Require explicitly trusted raw instructions inside `script` and `style`.
- Reject control characters in dynamic attribute names.
- Report stable `scriptJSON()` errors for cycles, bigints, and failing
  serializers while preserving their original causes.

### Changed

- Attribute and raw-text failures now include component or element context in
  `RenderError` diagnostics.
- Custom-element attributes are constrained to serializable server values.
- SVG types use serialized names such as `stroke-linecap` instead of React
  aliases such as `strokeLinecap`.

## 0.1.0 — 2026-08-09

- Initial server-only TSX runtime, immutable HTML instructions, deferred sync
  and async function components, buffered rendering, context-aware escaping,
  trust helpers, HTML-native JSX types, and a Web Standard response adapter.
