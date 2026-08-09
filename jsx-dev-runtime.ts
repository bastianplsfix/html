/**
 * JSX development runtime with source-location support.
 *
 * @module
 */

export {
  Fragment,
  jsx,
  jsxAttr,
  jsxDEV,
  jsxEscape,
  jsxs,
  jsxTemplate,
} from "./src/jsx_runtime.ts";
export type {
  JSXRuntimeComponent,
  JSXRuntimeElement,
} from "./src/jsx_runtime.ts";
export type { Html, Renderable, SourceLocation } from "./src/model.ts";
export type { JSX } from "./src/jsx_types.ts";
