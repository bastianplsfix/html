import {
  type ComponentNode,
  type ElementNode,
  type HtmlNode,
  isHtml,
  type Renderable,
  type SourceLocation,
} from "./model.ts";
import {
  assertValidTagName,
  escapeText,
  serializeAttribute,
} from "./escape.ts";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** Options shared by renderer entrypoints. */
export interface RenderOptions {
  /** Stops traversal when the signal is aborted. */
  readonly signal?: AbortSignal;
}

interface ComponentFrame {
  readonly name: string;
  readonly source?: SourceLocation;
}

/** An error enriched with the server-component path that produced it. */
export class RenderError extends Error {
  readonly componentStack: readonly ComponentFrame[];
  readonly detail: string;

  constructor(
    detail: string,
    componentStack: readonly ComponentFrame[] = [],
    options?: ErrorOptions,
  ) {
    super(formatMessage(detail, componentStack), options);
    this.name = "RenderError";
    this.detail = detail;
    this.componentStack = Object.freeze([...componentStack]);
  }
}

interface RenderContext {
  readonly chunks: string[];
  readonly signal?: AbortSignal;
}

/** Render a value to one buffered HTML string. */
export async function renderToString(
  view: Renderable,
  options: RenderOptions = {},
): Promise<string> {
  const context: RenderContext = {
    chunks: [],
    ...(options.signal ? { signal: options.signal } : {}),
  };

  await renderValue(view, context);
  throwIfAborted(context.signal);
  return context.chunks.join("");
}

async function renderValue(
  value: unknown,
  context: RenderContext,
): Promise<void> {
  throwIfAborted(context.signal);

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  switch (typeof value) {
    case "string":
      context.chunks.push(escapeText(value));
      return;
    case "number":
    case "bigint":
      context.chunks.push(String(value));
      return;
    case "function":
      throw unsupportedValue("function", value);
    case "symbol":
      throw unsupportedValue("symbol", value);
  }

  if (isHtml(value)) {
    await renderNode(value, context);
    return;
  }

  if (isPromiseLike(value)) {
    const resolved = await value;
    throwIfAborted(context.signal);
    await renderValue(resolved, context);
    return;
  }

  if (isAsyncIterable(value)) {
    for await (const child of value) {
      await renderValue(child, context);
      throwIfAborted(context.signal);
    }
    return;
  }

  if (isIterable(value)) {
    for (const child of value) {
      await renderValue(child, context);
      throwIfAborted(context.signal);
    }
    return;
  }

  throw unsupportedValue("object", value);
}

async function renderNode(
  node: HtmlNode,
  context: RenderContext,
): Promise<void> {
  switch (node.nodeType) {
    case "raw":
      context.chunks.push(node.value);
      return;
    case "escaped":
      await renderValue(node.value, context);
      return;
    case "attribute":
      context.chunks.push(serializeAttribute(node.name, node.value));
      return;
    case "fragment":
      await renderValue(node.children, context);
      return;
    case "template":
      if (node.strings.length !== node.values.length + 1) {
        throw new RenderError("Received a malformed precompiled JSX template.");
      }

      for (let index = 0; index < node.values.length; index++) {
        context.chunks.push(node.strings[index]);
        await renderValue(node.values[index], context);
      }
      context.chunks.push(node.strings[node.strings.length - 1]);
      return;
    case "component":
      await renderComponent(node, context);
      return;
    case "element":
      await renderElement(node, context);
      return;
  }
}

async function renderComponent(
  node: ComponentNode,
  context: RenderContext,
): Promise<void> {
  const frame: ComponentFrame = {
    name: node.component.name || "Anonymous",
    ...(node.source ? { source: node.source } : {}),
  };

  try {
    throwIfAborted(context.signal);
    await renderValue(node.component(node.props), context);
  } catch (error) {
    throw addComponentFrame(error, frame);
  }
}

async function renderElement(
  node: ElementNode,
  context: RenderContext,
): Promise<void> {
  assertValidTagName(node.tagName);
  const tagName = node.tagName;
  const children = node.props.children;

  context.chunks.push(`<${tagName}`);
  for (const [name, value] of Object.entries(node.props)) {
    if (name === "children") {
      continue;
    }

    const attribute = serializeAttribute(name, value);
    if (attribute.length > 0) {
      context.chunks.push(" ", attribute);
    }
  }
  context.chunks.push(">");

  if (VOID_ELEMENTS.has(tagName.toLowerCase())) {
    if (hasRenderableChildren(children)) {
      throw new RenderError(`Void element <${tagName}> cannot have children.`);
    }
    return;
  }

  await renderValue(children, context);
  context.chunks.push(`</${tagName}>`);
}

function hasRenderableChildren(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false &&
    value !== true;
}

function isPromiseLike(value: object): value is PromiseLike<unknown> {
  return "then" in value &&
    typeof (value as { then?: unknown }).then === "function";
}

function isAsyncIterable(value: object): value is AsyncIterable<unknown> {
  return Symbol.asyncIterator in value &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[
        Symbol.asyncIterator
      ] ===
      "function";
}

function isIterable(value: object): value is Iterable<unknown> {
  return Symbol.iterator in value &&
    typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
      "function";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

function unsupportedValue(kind: string, value: unknown): RenderError {
  return new RenderError(
    `Cannot render ${article(kind)} ${kind} as a child.\n\nReceived: ${
      describe(value)
    }`,
  );
}

function article(word: string): string {
  return /^[aeiou]/iu.test(word) ? "an" : "a";
}

function describe(value: unknown): string {
  if (typeof value === "function") {
    return value.name ? `[Function: ${value.name}]` : "[Function]";
  }

  if (typeof value === "symbol") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);
    if (json !== undefined && json.length <= 240) {
      return json;
    }
  } catch {
    // Fall through to a stable object tag.
  }

  return Object.prototype.toString.call(value);
}

function addComponentFrame(error: unknown, frame: ComponentFrame): RenderError {
  if (error instanceof RenderError) {
    return new RenderError(
      error.detail,
      [...error.componentStack, frame],
      { cause: error.cause ?? error },
    );
  }

  if (error instanceof Error) {
    return new RenderError(error.message, [frame], { cause: error });
  }

  return new RenderError(String(error), [frame], { cause: error });
}

function formatMessage(
  detail: string,
  componentStack: readonly ComponentFrame[],
): string {
  if (componentStack.length === 0) {
    return detail;
  }

  const lines = componentStack.map((frame) => {
    if (!frame.source?.fileName) {
      return `  at <${frame.name}>`;
    }

    const line = frame.source.lineNumber === undefined
      ? ""
      : `:${frame.source.lineNumber}`;
    const column = frame.source.columnNumber === undefined
      ? ""
      : `:${frame.source.columnNumber}`;
    return `  at <${frame.name}> (${frame.source.fileName}${line}${column})`;
  });

  return `${detail}\n\nComponent stack:\n${lines.join("\n")}`;
}
