# JSX type source data

`source-data.json` is a normalized, vendored snapshot used by
`tools/generate_jsx_types.ts`. Generation and drift checks are deterministic and
offline; only the explicit source-refresh command uses the network.

## Provenance

| Data                             | Pinned source                                                                | License                                                     | Use                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML and SVG element inventories | `@webref/elements@2.7.1`                                                     | MIT                                                         | Names, interfaces, definition links, and obsolete HTML markers extracted by W3C Webref from WHATWG HTML, SVG 2, SVG Animations, Filter Effects, and CSS Masking |
| HTML element attributes          | `html-element-attributes@3.5.0` (`90784de761f4ef808eb115f1bb14f7b60c91e620`) | MIT, © Titus Wormer                                         | Spec-derived element-to-attribute applicability, including legacy HTML attributes                                                                               |
| SVG element attributes           | `svg-element-attributes@2.2.0` (`d25e4c13d5501e1a0998a1c4771dd2d176e36496`)  | MIT, © Titus Wormer                                         | Spec-derived, case-sensitive element-to-attribute applicability                                                                                                 |
| ARIA attribute names             | `@webref/idl@3.82.1` WAI-ARIA IDL                                            | MIT; underlying specification uses the W3C Document License | Reflected `role` and `aria-*` names from WAI-ARIA 1.3                                                                                                           |
| ARIA roles                       | W3C ARIA commit `d67661624b0a49d653658c6d0d77113247ca4d27`                   | W3C Document License                                        | Concrete and abstract role inventory                                                                                                                            |

Every downloaded artifact has an exact URL and SHA-256 digest in both the
refresh script and normalized snapshot. Relevant upstream licenses:

- <https://github.com/w3c/webref/blob/main/LICENSE>
- <https://github.com/wooorm/html-element-attributes/blob/main/license>
- <https://github.com/wooorm/svg-element-attributes/blob/main/license>
- <https://github.com/w3c/aria/blob/main/LICENSE.md>

The notices that must accompany the vendored snapshot are retained in
[`LICENSES.md`](./LICENSES.md).

The generated value unions and a small set of post-snapshot additions are an
audited local policy layer. Each addition links to its normative definition in
`tools/generate_jsx_types.ts`. This is necessary because element applicability
datasets describe names, not the TypeScript value model.

## Coverage and policy boundaries

The current snapshot and generated output cover:

- all 142 HTML element names in Webref: 113 current and 29 obsolete;
- element-specific upstream maps for 77 HTML elements and 193 unique HTML
  attribute names;
- all 63 SVG element names in the selected current SVG specifications, with an
  upstream attribute map for every element and 233 unique SVG attribute names;
- all 51 `aria-*` reflected names plus `role` from the WAI-ARIA 1.3 IDL; and
- 88 concrete role names, excluding the 12 abstract roles from usable values.

The local policy layer adds six cross-spec web-platform attribute names not yet
present in the pinned HTML applicability package, removes `iframe[srcdoc]`, and
adds 12 XML/XLink namespace spellings. That produces 198 HTML and 245 SVG
attribute names before element-specific duplication. Inline `on*` event
attributes are filtered even if a future input includes them.

Coverage is intentionally not a claim that every attribute grammar can be
expressed perfectly in TypeScript. High-value enumerations and numeric forms are
modeled precisely; complex micro-syntaxes remain escaped strings. The HTML
applicability source includes legacy attributes but does not identify obsolete
attributes individually, so only obsolete elements receive generated
`@deprecated` annotations. MathML, CSS property typing, client event handlers,
and React aliases are outside this server-native JSX surface.

## Commands

Generate the checked-in type file without network access:

```sh
deno run --allow-write=src/jsx_types.ts tools/generate_jsx_types.ts
```

Check for drift without writing:

```sh
deno run --allow-read=src/jsx_types.ts tools/generate_jsx_types.ts --check
```

Refresh the pinned normalized snapshot after intentionally updating versions,
URLs, and digests in the refresh script:

```sh
deno run \
  --allow-net=unpkg.com,raw.githubusercontent.com \
  --allow-write=tools/jsx-types/source-data.json \
  tools/update_jsx_type_sources.ts
```

Review upstream changes before accepting regenerated output. A successful
integrity check only proves that the downloaded inputs match the versions pinned
in this repository.
