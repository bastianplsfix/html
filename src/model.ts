/** The runtime brand shared by all immutable HTML instruction values. */
export const HTML_NODE: unique symbol = Symbol.for(
  "@bastianplsfix/html.node",
);

/**
 * An immutable instruction that the renderer trusts as HTML markup.
 *
 * Plain strings are never `Html`; the renderer always treats them as text.
 */
export interface Html {
  readonly [HTML_NODE]: true;
}

/** Any value that can be consumed by the HTML renderer. */
export type Renderable =
  | Html
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Iterable<Renderable>
  | AsyncIterable<Renderable>
  | PromiseLike<Renderable>;

/** Values accepted between a component's opening and closing tags. */
export type Children = Renderable;

/** A server component. Components are invoked by the renderer, not by JSX. */
export type Component<Props = Record<never, never>> = (
  props: Props & { readonly children?: Children },
) => Renderable;

/** Source metadata supplied by development JSX transforms. */
export interface SourceLocation {
  readonly fileName?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
}

type AnyComponent = (
  props: Readonly<Record<string, unknown>>,
) => Renderable;

interface NodeBase extends Html {
  readonly nodeType:
    | "attribute"
    | "component"
    | "element"
    | "escaped"
    | "fragment"
    | "raw"
    | "template";
}

export interface TemplateNode extends NodeBase {
  readonly nodeType: "template";
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

export interface ComponentNode extends NodeBase {
  readonly nodeType: "component";
  readonly component: AnyComponent;
  readonly props: Readonly<Record<string, unknown>>;
  readonly source?: SourceLocation;
}

export interface ElementNode extends NodeBase {
  readonly nodeType: "element";
  readonly tagName: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly source?: SourceLocation;
}

export interface EscapedNode extends NodeBase {
  readonly nodeType: "escaped";
  readonly value: unknown;
}

export interface AttributeNode extends NodeBase {
  readonly nodeType: "attribute";
  readonly name: string;
  readonly value: unknown;
}

export interface RawNode extends NodeBase {
  readonly nodeType: "raw";
  readonly value: string;
}

export interface FragmentNode extends NodeBase {
  readonly nodeType: "fragment";
  readonly children: unknown;
}

export type HtmlNode =
  | TemplateNode
  | ComponentNode
  | ElementNode
  | EscapedNode
  | AttributeNode
  | RawNode
  | FragmentNode;

const nodeBase = {
  [HTML_NODE]: true,
} as const;

function freezeNode<Node extends HtmlNode>(node: Node): Node {
  return Object.freeze(node);
}

function freezeProps(
  props: Record<string, unknown> | null,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(props ?? {}) });
}

export function templateNode(
  strings: readonly string[],
  values: readonly unknown[],
): TemplateNode {
  return freezeNode({
    ...nodeBase,
    nodeType: "template",
    strings: Object.freeze([...strings]),
    values: Object.freeze([...values]),
  });
}

export function componentNode(
  component: AnyComponent,
  props: Record<string, unknown> | null,
  source?: SourceLocation,
): ComponentNode {
  return freezeNode({
    ...nodeBase,
    nodeType: "component",
    component,
    props: freezeProps(props),
    ...(source ? { source: Object.freeze({ ...source }) } : {}),
  });
}

export function elementNode(
  tagName: string,
  props: Record<string, unknown> | null,
  source?: SourceLocation,
): ElementNode {
  return freezeNode({
    ...nodeBase,
    nodeType: "element",
    tagName,
    props: freezeProps(props),
    ...(source ? { source: Object.freeze({ ...source }) } : {}),
  });
}

export function escapedNode(value: unknown): EscapedNode {
  return freezeNode({ ...nodeBase, nodeType: "escaped", value });
}

export function attributeNode(name: string, value: unknown): AttributeNode {
  return freezeNode({ ...nodeBase, nodeType: "attribute", name, value });
}

export function rawNode(value: string): RawNode {
  return freezeNode({ ...nodeBase, nodeType: "raw", value });
}

export function fragmentNode(children: unknown): FragmentNode {
  return freezeNode({ ...nodeBase, nodeType: "fragment", children });
}

export function isHtml(value: unknown): value is HtmlNode {
  return typeof value === "object" && value !== null &&
    (value as { [HTML_NODE]?: unknown })[HTML_NODE] === true;
}
