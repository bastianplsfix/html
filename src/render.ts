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
import { inspectUrlAttribute } from "./security.ts";

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

const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

/** A non-fatal security diagnostic discovered while rendering a value. */
export interface RenderWarning {
  /** Stable identifier suitable for programmatic warning handling. */
  readonly code: "dangerous-url-scheme";
  /** HTML attribute that caused the warning. */
  readonly attributeName: string;
  /** Executable URL scheme found after browser-style normalization. */
  readonly scheme: "javascript" | "vbscript";
  /** Original, unmodified attribute value. */
  readonly value: string;
  /** Human-readable explanation of the warning and its security boundary. */
  readonly message: string;
}

/** Options shared by renderer entrypoints. */
export interface RenderOptions {
  /** Stops traversal when the signal is aborted. */
  readonly signal?: AbortSignal;
  /** Receives security diagnostics without changing the rendered output. */
  readonly onWarning?: (warning: RenderWarning) => void;
}

/** One component in a `RenderError` stack, ordered innermost first. */
export interface ComponentFrame {
  /** Function name, or `Anonymous` when the function has no name. */
  readonly name: string;
  /** JSX source location retained by the development runtime, when available. */
  readonly source?: SourceLocation;
}

interface ElementFrame {
  readonly tagName: string;
  readonly source?: SourceLocation;
}

/** An error enriched with the server-component path that produced it. */
export class RenderError extends Error {
  /** Component frames collected while the error unwound, innermost first. */
  readonly componentStack: readonly ComponentFrame[];
  /** Original diagnostic text without the formatted component stack. */
  readonly detail: string;

  /**
   * Create a rendering error.
   *
   * Applications normally receive instances created by the renderer. The
   * constructor remains public so integrations can preserve component context
   * when translating errors.
   *
   * @param detail Diagnostic text without a formatted component stack.
   * @param componentStack Existing frames, ordered innermost first.
   * @param options Standard error options, including an underlying cause.
   */
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
  readonly onWarning?: (warning: RenderWarning) => void;
  readonly signal?: AbortSignal;
}

/**
 * Render a value to one buffered HTML string.
 *
 * Rendering proceeds in document order. Promises and async iterables are
 * awaited before the returned promise resolves, and plain strings are escaped.
 *
 * @param view Value, component instruction, or collection to render.
 * @param options Cancellation and warning-delivery options.
 * @returns The complete rendered HTML document or fragment.
 */
export async function renderToString(
  view: Renderable,
  options: RenderOptions = {},
): Promise<string> {
  const context: RenderContext = {
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const chunks: string[] = [];

  for await (const chunk of renderValue(view, context)) {
    throwIfAborted(context.signal);
    chunks.push(chunk);
  }
  throwIfAborted(context.signal);
  return chunks.join("");
}

/**
 * Render a value as an ordered stream of UTF-8 chunks.
 *
 * Traversal starts when the stream is read and follows normal stream
 * backpressure. Rendering failures are delivered as stream errors. Cancelling
 * the stream, or aborting `options.signal`, also closes active async iterators.
 *
 * @param view Value, component instruction, or collection to render.
 * @param options Cancellation and warning-delivery options.
 * @returns A byte stream containing the rendered HTML in document order.
 */
export function renderToStream(
  view: Renderable,
  options: RenderOptions = {},
): ReadableStream<Uint8Array> {
  const cancellation = new AbortController();
  const context: RenderContext = {
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
    signal: cancellation.signal,
  };
  const iterator = renderValue(view, context)[Symbol.asyncIterator]();
  const encoder = new StreamingUtf8Encoder();
  let removeAbortListener = () => {};
  let closing: Promise<void> | undefined;
  let cancelled = false;
  let settled = false;

  const closeIterator = (): Promise<void> => {
    if (!closing) {
      closing = iterator.return
        ? iterator.return().then(() => {})
        : Promise.resolve();
    }
    return closing;
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      removeAbortListener = listenForAbort(options.signal, () => {
        const reason = options.signal?.reason;
        cancellation.abort(reason);

        if (!settled) {
          settled = true;
          controller.error(reason);
          removeAbortListener();
          // The signal's reason remains the stream error even if an iterator's
          // cleanup later fails.
          void closeIterator().catch(() => {});
        }
      });
    },

    async pull(controller) {
      if (settled) {
        return;
      }

      try {
        // Empty strings and a trailing high surrogate do not produce bytes yet.
        // Continue only until one chunk is available so the consumer controls
        // the pace of traversal through normal stream backpressure.
        while (!cancelled) {
          throwIfAborted(context.signal);
          const result = await iterator.next();
          if (settled || cancelled) {
            return;
          }
          if (result.done) {
            const finalBytes = encoder.finish();
            if (finalBytes.byteLength > 0) {
              controller.enqueue(finalBytes);
            }
            controller.close();
            settled = true;
            removeAbortListener();
            return;
          }

          const bytes = encoder.encode(result.value);
          if (bytes.byteLength > 0) {
            controller.enqueue(bytes);
            return;
          }
        }
      } catch (error) {
        settled = true;
        removeAbortListener();
        if (!cancelled) {
          controller.error(error);
        }
      }
    },

    async cancel(reason) {
      if (settled) {
        return;
      }

      cancelled = true;
      cancellation.abort(reason);

      try {
        await closeIterator();
      } finally {
        settled = true;
        removeAbortListener();
      }
    },
  }, { highWaterMark: 0 });
}

async function* renderValue(
  value: unknown,
  context: RenderContext,
): AsyncGenerator<string, void, void> {
  throwIfAborted(context.signal);

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  switch (typeof value) {
    case "string":
      yield escapeText(value);
      return;
    case "number":
    case "bigint":
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
    const resolved = await awaitWithSignal(value, context.signal);
    throwIfAborted(context.signal);
    yield* renderValue(resolved, context);
    return;
  }

  if (isAsyncIterable(value)) {
    yield* renderAsyncIterable(value, context);
    return;
  }

  if (isIterable(value)) {
    for (const child of value) {
      yield* renderValue(child, context);
      throwIfAborted(context.signal);
    }
    return;
  }

  throw unsupportedValue("object", value);
}

async function* renderNode(
  node: HtmlNode,
  context: RenderContext,
): AsyncGenerator<string, void, void> {
  switch (node.nodeType) {
    case "raw":
      yield node.value;
      return;
    case "escaped":
      yield* renderValue(node.value, context);
      return;
    case "attribute":
      emitAttributeWarning(node.name, node.value, context);
      yield serializeAttribute(node.name, node.value);
      return;
    case "fragment":
      yield* renderValue(node.children, context);
      return;
    case "template":
      if (node.strings.length !== node.values.length + 1) {
        throw new RenderError("Received a malformed precompiled JSX template.");
      }

      for (let index = 0; index < node.values.length; index++) {
        yield node.strings[index];
        yield* renderValue(node.values[index], context);
      }
      yield node.strings[node.strings.length - 1];
      return;
    case "component":
      yield* renderComponent(node, context);
      return;
    case "element":
      yield* renderElement(node, context);
      return;
  }
}

async function* renderComponent(
  node: ComponentNode,
  context: RenderContext,
): AsyncGenerator<string, void, void> {
  const frame: ComponentFrame = {
    name: node.component.name || "Anonymous",
    ...(node.source ? { source: node.source } : {}),
  };

  try {
    throwIfAborted(context.signal);
    yield* renderValue(node.component(node.props), context);
  } catch (error) {
    if (context.signal?.aborted && error === context.signal.reason) {
      throw error;
    }
    throw addComponentFrame(error, frame);
  }
}

async function* renderElement(
  node: ElementNode,
  context: RenderContext,
): AsyncGenerator<string, void, void> {
  const tagName = node.tagName;
  const children = node.props.children;

  try {
    yield serializeOpeningTag(node, context);
  } catch (error) {
    throw addElementFrame(error, {
      tagName,
      ...(node.source ? { source: node.source } : {}),
    });
  }

  if (VOID_ELEMENTS.has(tagName.toLowerCase())) {
    if (hasRenderableChildren(children)) {
      throw addElementFrame(
        new RenderError(`Void element <${tagName}> cannot have children.`),
        {
          tagName,
          ...(node.source ? { source: node.source } : {}),
        },
      );
    }
    return;
  }

  if (RAW_TEXT_ELEMENTS.has(tagName.toLowerCase())) {
    try {
      yield* renderRawTextValue(children, context, tagName.toLowerCase());
    } catch (error) {
      if (context.signal?.aborted && error === context.signal.reason) {
        throw error;
      }
      throw addElementFrame(error, {
        tagName,
        ...(node.source ? { source: node.source } : {}),
      });
    }
  } else {
    yield* renderValue(children, context);
  }
  yield `</${tagName}>`;
}

function serializeOpeningTag(
  node: ElementNode,
  context: RenderContext,
): string {
  assertValidTagName(node.tagName);
  let openingTag = `<${node.tagName}`;

  for (const [name, value] of Object.entries(node.props)) {
    if (name === "children") {
      continue;
    }

    emitAttributeWarning(name, value, context);
    const attribute = serializeAttribute(name, value);
    if (attribute.length > 0) {
      openingTag += ` ${attribute}`;
    }
  }

  return `${openingTag}>`;
}

async function* renderRawTextValue(
  value: unknown,
  context: RenderContext,
  tagName: string,
): AsyncGenerator<string, void, void> {
  throwIfAborted(context.signal);

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  if (isHtml(value)) {
    switch (value.nodeType) {
      case "raw":
        yield value.value;
        return;
      case "fragment":
        yield* renderRawTextValue(value.children, context, tagName);
        return;
      case "component":
        yield* renderRawTextComponent(value, context, tagName);
        return;
      default:
        throw rawTextChildError(tagName);
    }
  }

  if (typeof value === "object") {
    if (isPromiseLike(value)) {
      const resolved = await awaitWithSignal(value, context.signal);
      yield* renderRawTextValue(resolved, context, tagName);
      return;
    }

    if (isAsyncIterable(value)) {
      yield* renderRawTextAsyncIterable(value, context, tagName);
      return;
    }

    if (isIterable(value)) {
      for (const child of value) {
        yield* renderRawTextValue(child, context, tagName);
        throwIfAborted(context.signal);
      }
      return;
    }
  }

  throw rawTextChildError(tagName);
}

async function* renderRawTextComponent(
  node: ComponentNode,
  context: RenderContext,
  tagName: string,
): AsyncGenerator<string, void, void> {
  const frame: ComponentFrame = {
    name: node.component.name || "Anonymous",
    ...(node.source ? { source: node.source } : {}),
  };

  try {
    throwIfAborted(context.signal);
    yield* renderRawTextValue(node.component(node.props), context, tagName);
  } catch (error) {
    if (context.signal?.aborted && error === context.signal.reason) {
      throw error;
    }
    throw addComponentFrame(error, frame);
  }
}

async function* renderRawTextAsyncIterable(
  value: AsyncIterable<unknown>,
  context: RenderContext,
  tagName: string,
): AsyncGenerator<string, void, void> {
  const iterator = value[Symbol.asyncIterator]();
  let completed = false;

  try {
    while (true) {
      throwIfAborted(context.signal);
      const result = await awaitWithSignal(iterator.next(), context.signal);
      if (result.done) {
        completed = true;
        return;
      }

      yield* renderRawTextValue(result.value, context, tagName);
      throwIfAborted(context.signal);
    }
  } finally {
    if (!completed && typeof iterator.return === "function") {
      await iterator.return();
    }
  }
}

async function* renderAsyncIterable(
  value: AsyncIterable<unknown>,
  context: RenderContext,
): AsyncGenerator<string, void, void> {
  const iterator = value[Symbol.asyncIterator]();
  let completed = false;

  try {
    while (true) {
      throwIfAborted(context.signal);
      const result = await awaitWithSignal(iterator.next(), context.signal);
      if (result.done) {
        completed = true;
        return;
      }

      yield* renderValue(result.value, context);
      throwIfAborted(context.signal);
    }
  } finally {
    if (!completed && typeof iterator.return === "function") {
      await iterator.return();
    }
  }
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

function emitAttributeWarning(
  name: string,
  value: unknown,
  context: RenderContext,
): void {
  const warning = inspectUrlAttribute(name, value);
  if (warning) {
    context.onWarning?.(warning);
  }
}

function rawTextChildError(tagName: string): RenderError {
  const guidance = tagName === "script"
    ? "Use scriptJSON() for embedded data or unsafeHTML() for trusted script source."
    : "Use unsafeHTML() for trusted style source.";

  return new RenderError(
    `Plain renderable values are not allowed inside <${tagName}> because HTML raw-text elements require context-specific handling. ${guidance}`,
  );
}

function awaitWithSignal<T>(
  value: PromiseLike<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) {
    return Promise.resolve(value);
  }

  signal.throwIfAborted();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(value).then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function listenForAbort(
  source: AbortSignal | undefined,
  listener: () => void,
): () => void {
  if (!source) {
    return () => {};
  }

  if (source.aborted) {
    listener();
    return () => {};
  }

  source.addEventListener("abort", listener, { once: true });
  return () => source.removeEventListener("abort", listener);
}

class StreamingUtf8Encoder {
  readonly #encoder = new TextEncoder();
  #pendingHighSurrogate = "";

  encode(chunk: string): Uint8Array {
    let value = this.#pendingHighSurrogate + chunk;
    this.#pendingHighSurrogate = "";

    if (value.length > 0) {
      const finalCodeUnit = value.charCodeAt(value.length - 1);
      if (finalCodeUnit >= 0xD800 && finalCodeUnit <= 0xDBFF) {
        this.#pendingHighSurrogate = value[value.length - 1];
        value = value.slice(0, -1);
      }
    }

    return value.length === 0 ? new Uint8Array() : this.#encoder.encode(value);
  }

  finish(): Uint8Array {
    const value = this.#pendingHighSurrogate;
    this.#pendingHighSurrogate = "";
    return value.length === 0 ? new Uint8Array() : this.#encoder.encode(value);
  }
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

function addElementFrame(error: unknown, frame: ElementFrame): RenderError {
  const location = formatSourceLocation(frame.source);
  const elementDetail = `Element: <${frame.tagName}>${location}`;

  if (error instanceof RenderError) {
    return new RenderError(
      `${error.detail}\n\n${elementDetail}`,
      error.componentStack,
      { cause: error.cause ?? error },
    );
  }

  if (error instanceof Error) {
    return new RenderError(`${error.message}\n\n${elementDetail}`, [], {
      cause: error,
    });
  }

  return new RenderError(`${String(error)}\n\n${elementDetail}`, [], {
    cause: error,
  });
}

function formatMessage(
  detail: string,
  componentStack: readonly ComponentFrame[],
): string {
  if (componentStack.length === 0) {
    return detail;
  }

  const lines = componentStack.map((frame) => {
    return `  at <${frame.name}>${formatSourceLocation(frame.source)}`;
  });

  return `${detail}\n\nComponent stack:\n${lines.join("\n")}`;
}

function formatSourceLocation(source: SourceLocation | undefined): string {
  if (!source?.fileName) {
    return "";
  }

  const line = source.lineNumber === undefined ? "" : `:${source.lineNumber}`;
  const column = source.columnNumber === undefined
    ? ""
    : `:${source.columnNumber}`;
  return ` (${source.fileName}${line}${column})`;
}
