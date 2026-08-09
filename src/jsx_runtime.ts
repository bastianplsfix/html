import {
  attributeNode,
  componentNode,
  elementNode,
  escapedNode,
  fragmentNode,
  type Html,
  isHtml,
  type Renderable,
  type SourceLocation,
  templateNode,
} from "./model.ts";

/** Fragment marker used by the automatic JSX runtimes. */
export const Fragment: unique symbol = Symbol.for(
  "@bastianplsfix/html.Fragment",
);

/** A component callable accepted by compiler-generated JSX runtime calls. */
export type JSXRuntimeComponent = (
  props: Readonly<Record<string, unknown>>,
) => Renderable;

/** An intrinsic tag, component, or fragment accepted by the JSX runtime. */
export type JSXRuntimeElement =
  | string
  | JSXRuntimeComponent
  | typeof Fragment;

function createInstruction(
  type: JSXRuntimeElement,
  props: Record<string, unknown> | null,
  source?: SourceLocation,
): Html {
  if (type === Fragment) {
    return fragmentNode(props?.children);
  }

  if (typeof type === "function") {
    return componentNode(type, props, source);
  }

  if (typeof type === "string") {
    return elementNode(type, props, source);
  }

  throw new TypeError("JSX element types must be strings or components.");
}

/** Automatic JSX runtime entrypoint. */
export function jsx(
  type: JSXRuntimeElement,
  props: Record<string, unknown> | null,
  _key?: unknown,
): Html {
  return createInstruction(type, props);
}

/** Automatic JSX runtime entrypoint for elements with multiple children. */
export const jsxs: typeof jsx = jsx;

/** Development automatic JSX runtime entrypoint. */
export function jsxDEV(
  type: JSXRuntimeElement,
  props: Record<string, unknown> | null,
  _key?: unknown,
  _isStaticChildren?: boolean,
  source?: SourceLocation,
  _self?: unknown,
): Html {
  return createInstruction(type, props, source);
}

/** Deno precompile runtime entrypoint for a static template. */
export function jsxTemplate(
  strings: readonly string[],
  ...values: readonly unknown[]
): Html {
  return templateNode(strings, values);
}

/** Deno precompile runtime entrypoint for a dynamic attribute. */
export function jsxAttr(name: string, value: unknown): Html {
  return attributeNode(name, value);
}

/** Deno precompile runtime entrypoint for a dynamic child. */
export function jsxEscape(value: unknown): Html {
  return isHtml(value) ? value : escapedNode(value);
}
