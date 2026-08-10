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
  /** Receives non-fatal diagnostics discovered while rendering. */
  readonly onWarning?: (warning: RenderWarning) => void;
}

/** A non-fatal diagnostic discovered while rendering a view. */
export interface RenderWarning {
  readonly code: "dangerous-url-scheme";
  readonly message: string;
  readonly attributeName: string;
  readonly value: string;
  readonly source?: SourceLocation;
}

/** A server-component frame recorded while a value is being rendered. */
export interface ComponentFrame {
  readonly name: string;
  readonly source?: SourceLocation;
}

/** An intrinsic-element frame associated with a render failure. */
export interface ElementFrame {
  readonly name: string;
  readonly source?: SourceLocation;
}

/** Options for constructing a structured render error. */
export interface RenderErrorOptions extends ErrorOptions {
  readonly element?: ElementFrame;
}

/** An error enriched with element source context and its server-component path. */
export class RenderError extends Error {
  readonly componentStack: readonly ComponentFrame[];
  readonly detail: string;
  readonly element?: ElementFrame;

  constructor(
    detail: string,
    componentStack: readonly ComponentFrame[] = [],
    options?: RenderErrorOptions,
  ) {
    super(formatMessage(detail, componentStack, options?.element), options);
    this.name = "RenderError";
    this.detail = detail;
    this.componentStack = Object.freeze([...componentStack]);
    if (options?.element) {
      this.element = Object.freeze({ ...options.element });
    }
  }
}

interface RenderContext {
  readonly signal?: AbortSignal;
  readonly onWarning?: (warning: RenderWarning) => void;
  readonly rawTextElement?: ElementFrame;
}

/** Render a value to one buffered HTML string. */
export async function renderToString(
  view: Renderable,
  options: RenderOptions = {},
): Promise<string> {
  const context: RenderContext = {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
  };
  const chunks: string[] = [];

  try {
    for await (const chunk of renderChunks(view, context)) {
      chunks.push(chunk);
    }
    throwIfAborted(context.signal);
    return chunks.join("");
  } catch (error) {
    if (isAbortReason(error, context.signal)) {
      throw error;
    }

    throw normalizeRenderError(error);
  }
}

/** Render a value as an ordered UTF-8 HTML stream. */
export function renderToStream(
  view: Renderable,
  options: RenderOptions = {},
): ReadableStream<Uint8Array> {
  const context: RenderContext = {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
  };
  const chunks = renderChunks(view, context);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const result = await chunks.next();

          if (result.done) {
            controller.close();
            return;
          }

          if (result.value.length > 0) {
            controller.enqueue(encoder.encode(result.value));
            return;
          }
        }
      } catch (error) {
        controller.error(
          isAbortReason(error, context.signal)
            ? error
            : normalizeRenderError(error),
        );
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

async function* renderChunks(
  value: unknown,
  context: RenderContext,
): AsyncGenerator<string> {
  throwIfAborted(context.signal);

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  switch (typeof value) {
    case "string":
      assertTextAllowed(context);
      yield escapeText(value);
      return;
    case "number":
    case "bigint":
      assertTextAllowed(context);
      yield String(value);
      return;
    case "function":
      throw unsupportedValue("function", value);
    case "symbol":
      throw unsupportedValue("symbol", value);
  }

  if (isHtml(value)) {
    yield* renderNode(value, context);
    return;
  }

  if (isPromiseLike(value)) {
    const resolved = await value;
    throwIfAborted(context.signal);
    yield* renderChunks(resolved, context);
    return;
  }

  if (isAsyncIterable(value)) {
    yield* renderAsyncIterable(value, context);
    return;
  }

  if (isIterable(value)) {
    yield* renderIterable(value, context);
    return;
  }

  throw unsupportedValue("object", value);
}

async function* renderAsyncIterable(
  value: AsyncIterable<unknown>,
  context: RenderContext,
): AsyncGenerator<string> {
  const iterator = value[Symbol.asyncIterator]();
  let completed = false;
  let failure: unknown;
  let failed = false;

  try {
    while (true) {
      throwIfAborted(context.signal);
      const result = await iterator.next();
      throwIfAborted(context.signal);

      if (result.done) {
        completed = true;
        return;
      }

      yield* renderChunks(result.value, context);
    }
  } catch (error) {
    failure = error;
    failed = true;
  } finally {
    if (!completed) {
      if (failed) {
        try {
          await iterator.return?.();
        } catch {
          // Preserve the primary traversal failure.
        }
      } else {
        await iterator.return?.();
      }
    }
  }

  if (failed) {
    throw failure;
  }
}

async function* renderIterable(
  value: Iterable<unknown>,
  context: RenderContext,
): AsyncGenerator<string> {
  const iterator = value[Symbol.iterator]();
  let completed = false;
  let failure: unknown;
  let failed = false;

  try {
    while (true) {
      throwIfAborted(context.signal);
      const result = iterator.next();

      if (result.done) {
        completed = true;
        return;
      }

      yield* renderChunks(result.value, context);
      throwIfAborted(context.signal);
    }
  } catch (error) {
    failure = error;
    failed = true;
  } finally {
    if (!completed) {
      if (failed) {
        try {
          iterator.return?.();
        } catch {
          // Preserve the primary traversal failure.
        }
      } else {
        iterator.return?.();
      }
    }
  }

  if (failed) {
    throw failure;
  }
}

async function* renderNode(
  node: HtmlNode,
  context: RenderContext,
): AsyncGenerator<string> {
  assertValidHtmlNode(node);

  if (
    context.rawTextElement &&
    node.nodeType !== "raw" &&
    node.nodeType !== "fragment" &&
    node.nodeType !== "component"
  ) {
    throw rawTextChildError(context.rawTextElement);
  }

  switch (node.nodeType) {
    case "raw":
      yield node.value;
      return;
    case "escaped":
      yield* renderChunks(node.value, context);
      return;
    case "attribute":
      warnForDangerousUrl(node.name, node.value, context);
      yield serializeAttribute(node.name, node.value);
      return;
    case "fragment":
      yield* renderChunks(node.children, context);
      return;
    case "template":
      for (let index = 0; index < node.values.length; index++) {
        yield node.strings[index];
        yield* renderChunks(node.values[index], context);
      }
      yield node.strings[node.strings.length - 1];
      return;
    case "component":
      yield* renderComponent(node, context);
      return;
    case "element":
      yield* renderElement(node, context);
      return;
    default:
      throw new RenderError("Received an unknown HTML instruction.");
  }
}

function assertValidHtmlNode(node: HtmlNode): void {
  const instruction = node as unknown as Record<PropertyKey, unknown>;

  switch (instruction.nodeType) {
    case "raw":
      assertInstructionField(instruction, "value", "string");
      return;
    case "escaped":
    case "fragment":
      return;
    case "attribute":
      assertInstructionField(instruction, "name", "string");
      return;
    case "template": {
      if (
        !Array.isArray(instruction.strings) ||
        !instruction.strings.every((value) => typeof value === "string") ||
        !Array.isArray(instruction.values) ||
        instruction.strings.length !== instruction.values.length + 1
      ) {
        throw malformedInstruction("template");
      }
      return;
    }
    case "component":
      assertInstructionField(instruction, "component", "function");
      assertInstructionProps(instruction, "component");
      assertInstructionSource(instruction, "component");
      return;
    case "element":
      assertInstructionField(instruction, "tagName", "string");
      assertInstructionProps(instruction, "element");
      assertInstructionSource(instruction, "element");
      return;
    default:
      throw new RenderError("Received an unknown HTML instruction.");
  }
}

function assertInstructionField(
  instruction: Record<PropertyKey, unknown>,
  field: string,
  expectedType: "function" | "string",
): void {
  if (typeof instruction[field] !== expectedType) {
    throw malformedInstruction(String(instruction.nodeType));
  }
}

function assertInstructionProps(
  instruction: Record<PropertyKey, unknown>,
  nodeType: "component" | "element",
): void {
  const props = instruction.props;
  if (
    typeof props !== "object" || props === null || Array.isArray(props) ||
    !isPlainRecord(props)
  ) {
    throw malformedInstruction(nodeType);
  }
}

function assertInstructionSource(
  instruction: Record<PropertyKey, unknown>,
  nodeType: "component" | "element",
): void {
  const source = instruction.source;
  if (source === undefined) {
    return;
  }

  if (
    typeof source !== "object" || source === null || Array.isArray(source) ||
    !isPlainRecord(source)
  ) {
    throw malformedInstruction(nodeType);
  }

  const location = source as Record<PropertyKey, unknown>;
  if (
    (location.fileName !== undefined && typeof location.fileName !== "string") ||
    (location.lineNumber !== undefined &&
      typeof location.lineNumber !== "number") ||
    (location.columnNumber !== undefined &&
      typeof location.columnNumber !== "number")
  ) {
    throw malformedInstruction(nodeType);
  }
}

function isPlainRecord(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function malformedInstruction(nodeType: string): RenderError {
  return new RenderError(`Received a malformed ${nodeType} HTML instruction.`);
}

async function* renderComponent(
  node: ComponentNode,
  context: RenderContext,
): AsyncGenerator<string> {
  const frame: ComponentFrame = {
    name: node.component.name || "Anonymous",
    ...(node.source ? { source: node.source } : {}),
  };

  try {
    throwIfAborted(context.signal);
    yield* renderChunks(node.component(node.props), context);
  } catch (error) {
    if (isAbortReason(error, context.signal)) {
      throw error;
    }

    throw addComponentFrame(error, frame);
  }
}

async function* renderElement(
  node: ElementNode,
  context: RenderContext,
): AsyncGenerator<string> {
  const tagName = node.tagName;
  const frame: ElementFrame = {
    name: tagName,
    ...(node.source ? { source: node.source } : {}),
  };
  let normalizedTagName: string;
  let children: unknown;
  let isVoid: boolean;
  let serializedAttributes: string;

  try {
    assertValidTagName(tagName);
    normalizedTagName = tagName.toLowerCase();
    children = node.props.children;
    isVoid = VOID_ELEMENTS.has(normalizedTagName);

    if (isVoid && hasRenderableChildren(children)) {
      throw new RenderError(`Void element <${tagName}> cannot have children.`);
    }

    const attributes: string[] = [];

    for (const [name, value] of Object.entries(node.props)) {
      if (name === "children") {
        continue;
      }

      warnForDangerousUrl(name, value, context, node.source);
      const attribute = serializeAttribute(name, value);
      if (attribute.length > 0) {
        attributes.push(attribute);
      }
    }

    serializedAttributes = attributes.length === 0
      ? ""
      : ` ${attributes.join(" ")}`;
  } catch (error) {
    throw addElementFrame(error, frame);
  }

  yield `<${tagName}${serializedAttributes}>`;

  if (isVoid) {
    return;
  }

  let rawTextElement: ElementFrame | undefined;
  if (normalizedTagName === "script" || normalizedTagName === "style") {
    rawTextElement = frame;
  }
  const childContext: RenderContext = rawTextElement
    ? {
      ...context,
      rawTextElement,
    }
    : context;

  yield* renderChunks(children, childContext);
  yield `</${tagName}>`;
}

function assertTextAllowed(context: RenderContext): void {
  if (context.rawTextElement) {
    throw rawTextChildError(context.rawTextElement);
  }
}

function rawTextChildError(element: ElementFrame): RenderError {
  const tagName = element.name.toLowerCase() as "script" | "style";
  const helper = tagName === "script"
    ? "scriptJSON() for JSON or unsafeHTML() for trusted source"
    : "unsafeHTML() for trusted CSS";

  return new RenderError(
    `Plain <${tagName}> children are not escaped safely. Use ${helper}.`,
    [],
    { element },
  );
}

const URL_ATTRIBUTES = new Set([
  "action",
  "cite",
  "formaction",
  "href",
  "poster",
  "src",
  "xlink:href",
]);

function warnForDangerousUrl(
  name: string,
  value: unknown,
  context: RenderContext,
  source?: SourceLocation,
): void {
  if (!context.onWarning || !URL_ATTRIBUTES.has(name.toLowerCase())) {
    return;
  }

  if (
    typeof value !== "string" && typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    return;
  }

  const serializedValue = String(value);
  const normalizedValue = serializedValue
    .replace(/[\u0000-\u0020\u007f]+/gu, "")
    .toLowerCase();
  const dangerous = normalizedValue.startsWith("javascript:") ||
    normalizedValue.startsWith("vbscript:") ||
    normalizedValue.startsWith("data:text/html") ||
    normalizedValue.startsWith("data:image/svg+xml");

  if (!dangerous) {
    return;
  }

  const attributeName = name.toLowerCase();
  context.onWarning({
    code: "dangerous-url-scheme",
    message:
      `Potentially dangerous URL in the ${JSON.stringify(attributeName)} attribute: ${JSON.stringify(serializedValue)}. HTML escaping does not make URL schemes safe.`,
    attributeName,
    value: serializedValue,
    ...(source ? { source } : {}),
  });
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

function isAbortReason(
  error: unknown,
  signal: AbortSignal | undefined,
): boolean {
  return signal?.aborted === true && error === signal.reason;
}

function normalizeRenderError(error: unknown): RenderError {
  if (error instanceof RenderError) {
    return error;
  }

  if (error instanceof Error) {
    return new RenderError(error.message, [], { cause: error });
  }

  return new RenderError(String(error), [], { cause: error });
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
      {
        cause: error.cause ?? error,
        ...(error.element ? { element: error.element } : {}),
      },
    );
  }

  if (error instanceof Error) {
    return new RenderError(error.message, [frame], { cause: error });
  }

  return new RenderError(String(error), [frame], { cause: error });
}

function addElementFrame(error: unknown, frame: ElementFrame): RenderError {
  if (error instanceof RenderError) {
    if (error.element) {
      return error;
    }

    return new RenderError(error.detail, error.componentStack, {
      cause: error.cause ?? error,
      element: frame,
    });
  }

  if (error instanceof Error) {
    return new RenderError(error.message, [], { cause: error, element: frame });
  }

  return new RenderError(String(error), [], { cause: error, element: frame });
}

function formatMessage(
  detail: string,
  componentStack: readonly ComponentFrame[],
  element?: ElementFrame,
): string {
  if (componentStack.length === 0 && !element) {
    return detail;
  }

  const sections: string[] = [detail];

  if (element) {
    sections.push(`Element:\n${formatFrame(element)}`);
  }

  if (componentStack.length > 0) {
    const lines = componentStack.map(formatFrame);
    sections.push(`Component stack:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatFrame(frame: ComponentFrame | ElementFrame): string {
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
}
