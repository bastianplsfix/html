/**
 * JSX automatic and Deno precompile runtime.
 *
 * This entrypoint is imported by the compiler and is not normally imported by
 * application code.
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
export type { JSX } from "./src/jsx_types.ts";
