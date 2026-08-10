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

/** Intrinsic element associated with a rendering failure. */
export interface ElementFrame {
  /** Serialized intrinsic tag name. */
  readonly name: string;
  /** JSX source location retained by the development runtime, when available. */
  readonly source?: SourceLocation;
}

/** Options for constructing a structured rendering error. */
export interface RenderErrorOptions extends ErrorOptions {
  /** Intrinsic element associated with the failure. */
  readonly element?: ElementFrame;
}

/** An error enriched with the server-component path that produced it. */
export class RenderError extends Error {
  /** Component frames collected while the error unwound, innermost first. */
  readonly componentStack: readonly ComponentFrame[];
  /** Original diagnostic text without the formatted component stack. */
  readonly detail: string;
  /** Intrinsic element associated with the failure, when known. */
  readonly element?: ElementFrame;

  /**
   * Create a rendering error.
   *
   * Applications normally receive instances created by the renderer. The
   * constructor remains public so integrations can preserve component context
   * when translating errors.
   *
   * @param detail Diagnostic text without a formatted component stack.
   * @param componentStack Existing frames, ordered innermost first.
   * @param options Error cause and optional intrinsic-element context.
   */
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
  readonly cleanupPolicy?: { awaitOnAbort: boolean };
  readonly onWarning?: (warning: RenderWarning) => void;
  readonly signal?: AbortSignal;
  readonly syncBudget?: {
    deadline: number;
    remaining: number;
    checksUntilYield: number;
  };
}

type ProtocolMethod = (this: unknown, ...args: unknown[]) => unknown;
type RenderSegment = string | typeof STREAM_FLUSH;
type ChildRenderer = (
  value: unknown,
  context: RenderContext,
) => AsyncGenerator<RenderSegment, void, void>;
type BufferedResult = void | Promise<void>;

const NO_FAILURE: unique symbol = Symbol("no render failure");
const ARRAY_ITERATOR = Array.prototype[Symbol.iterator];
const VALIDATED_TEMPLATE_NODES = new WeakSet<object>();
// A buffered traversal is otherwise one uninterrupted JavaScript task. Yield
// after a bounded amount of synchronous work so timers and request-abort
// events can run without putting a task hop on ordinary page renders.
const BUFFERED_SYNC_BUDGET = 1_024;
const BUFFERED_CHECKS_UNTIL_YIELD = 16;
const BUFFERED_TASK_INTERVAL_MS = 4;
const DIAGNOSTIC_VALUE_CODE_UNITS = 160;
const RAW_TEXT_OPENING_CANDIDATE = /<(?:script|style)(?=[\t\n\f\r />]|$)/iu;
const STREAM_CHUNK_CODE_UNITS = 16 * 1_024;
const STREAM_CHUNK_SEGMENTS = 32;
const STREAM_READY_MICROTASKS = 24;
const STREAM_FLUSH: unique symbol = Symbol("flush stream prefix");
const NEXT_NOT_READY: unique symbol = Symbol("next result not ready");
const NOT_IMMEDIATE: unique symbol = Symbol(
  "value is not immediately renderable",
);

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
    syncBudget: {
      deadline: performance.now() + BUFFERED_TASK_INTERVAL_MS,
      remaining: BUFFERED_SYNC_BUDGET,
      checksUntilYield: BUFFERED_CHECKS_UNTIL_YIELD,
    },
  };
  const chunks: string[] = [];

  try {
    const pending = renderBufferedValue(view, context, chunks);
    if (pending) {
      await pending;
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

/**
 * Render a value as an ordered stream of UTF-8 chunks.
 *
 * Traversal starts when the stream is read and follows normal stream
 * backpressure. Rendering failures are delivered as stream errors. Cancelling
 * the stream, or aborting `options.signal`, also closes active async iterators.
 * Reader cancellation waits for asynchronous iterator cleanup; signal aborts
 * remain prompt and let uncooperative cleanup finish in the background.
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
  const cleanupPolicy = { awaitOnAbort: false };
  const context: RenderContext = {
    cleanupPolicy,
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
    signal: cancellation.signal,
  };
  const iterator = renderValue(view, context)[Symbol.asyncIterator]();
  const encoder = new StreamingUtf8Encoder();
  let removeAbortListener = () => {};
  let closing: Promise<void> | undefined;
  let cancelled = false;
  let settled = false;
  let bufferedText = "";
  let bufferedSegments = 0;
  let pendingNext: Promise<IteratorResult<RenderSegment, void>> | undefined;

  const takeBufferedText = (): string => {
    const length = Math.min(bufferedText.length, STREAM_CHUNK_CODE_UNITS);
    const chunk = bufferedText.slice(0, length);
    bufferedText = bufferedText.slice(length);
    // A remainder can only belong to the last, individually-large segment.
    bufferedSegments = bufferedText.length === 0 ? 0 : 1;
    return chunk;
  };

  const enqueueBufferedText = (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): boolean => {
    if (bufferedText.length === 0) {
      bufferedSegments = 0;
      return false;
    }

    const bytes = encoder.encode(takeBufferedText());
    if (bytes.byteLength === 0) {
      return false;
    }
    controller.enqueue(bytes);
    return true;
  };

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
        while (!cancelled) {
          throwIfAborted(context.signal);

          if (
            bufferedText.length >= STREAM_CHUNK_CODE_UNITS ||
            bufferedSegments >= STREAM_CHUNK_SEGMENTS
          ) {
            if (enqueueBufferedText(controller)) {
              return;
            }
          }

          const next = pendingNext ??= iterator.next();
          let result: IteratorResult<RenderSegment, void>;

          try {
            if (bufferedText.length > 0) {
              const ready = await pollIteratorNext(next);
              if (ready === NEXT_NOT_READY) {
                if (enqueueBufferedText(controller)) {
                  return;
                }
                continue;
              }
              if (ready.ok) {
                result = ready.result;
              } else {
                throw ready.error;
              }
            } else {
              result = await next;
            }
            pendingNext = undefined;
          } catch (error) {
            // Bytes produced before a synchronous downstream failure remain a
            // valid stream prefix. Surface the failure on the following pull.
            if (enqueueBufferedText(controller)) {
              return;
            }
            throw error;
          }

          if (settled || cancelled) {
            return;
          }
          if (result.done) {
            const finalBytes = concatenateBytes(
              encoder.encode(bufferedText),
              encoder.finish(),
            );
            bufferedText = "";
            bufferedSegments = 0;
            if (finalBytes.byteLength > 0) {
              controller.enqueue(finalBytes);
            }
            controller.close();
            settled = true;
            removeAbortListener();
            return;
          }

          if (result.value === STREAM_FLUSH) {
            if (enqueueBufferedText(controller)) {
              return;
            }
            continue;
          }

          bufferedText += result.value;
          bufferedSegments++;
        }
      } catch (error) {
        if (settled || cancelled) {
          return;
        }
        settled = true;
        removeAbortListener();
        controller.error(
          isAbortReason(error, context.signal)
            ? error
            : normalizeRenderError(error),
        );
      }
    },

    async cancel(reason) {
      if (settled) {
        return;
      }

      cancelled = true;
      cleanupPolicy.awaitOnAbort = true;
      cancellation.abort(reason);
      removeAbortListener();

      try {
        await closeIterator();
      } finally {
        settled = true;
      }
    },
  }, { highWaterMark: 0 });
}

function renderBufferedValue(
  value: unknown,
  context: RenderContext,
  chunks: string[],
): BufferedResult {
  throwIfAborted(context.signal);

  const budget = context.syncBudget;
  if (budget && budget.remaining-- <= 0) {
    budget.remaining = BUFFERED_SYNC_BUDGET;
    budget.checksUntilYield--;
    if (
      budget.checksUntilYield <= 0 || performance.now() >= budget.deadline
    ) {
      budget.checksUntilYield = BUFFERED_CHECKS_UNTIL_YIELD;
      return yieldToHostTask().then(() => {
        budget.deadline = performance.now() + BUFFERED_TASK_INTERVAL_MS;
        return renderBufferedValue(value, context, chunks);
      });
    }
    // Even when a host-task yield is not due yet, break synchronous component
    // recursion at every budget boundary. The occasional host-task escalation
    // above exists for timer/request cancellation; this microtask continuation
    // exists for stack safety.
    return Promise.resolve().then(() => {
      return renderBufferedValue(value, context, chunks);
    });
  }

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  switch (typeof value) {
    case "string":
      chunks.push(escapeText(value));
      return;
    case "number":
    case "bigint":
      chunks.push(String(value));
      return;
    case "function":
      throw unsupportedValue("function", value);
    case "symbol":
      throw unsupportedValue("symbol", value);
  }

  if (isHtml(value)) {
    return renderBufferedNode(value, context, chunks);
  }

  const thenMethod = getThenMethod(value);
  if (thenMethod) {
    return resolveAwaitable(value, thenMethod, context.signal).then(
      (resolved) => renderBufferedValue(resolved, context, chunks),
    );
  }

  const asyncIteratorMethod = getIteratorMethod(
    value,
    Symbol.asyncIterator,
    "Symbol.asyncIterator",
  );
  if (asyncIteratorMethod) {
    return consumeRenderedGenerator(
      renderProtocolIterable(
        value,
        asyncIteratorMethod,
        true,
        context,
        renderValue,
      ),
      context,
      chunks,
    );
  }

  const iteratorMethod = getIteratorMethod(
    value,
    Symbol.iterator,
    "Symbol.iterator",
  );
  if (iteratorMethod) {
    if (
      Array.isArray(value) &&
      iteratorMethod === ARRAY_ITERATOR
    ) {
      return renderBufferedArray(value, 0, context, chunks);
    }
    return consumeRenderedGenerator(
      renderProtocolIterable(
        value,
        iteratorMethod,
        false,
        context,
        renderValue,
      ),
      context,
      chunks,
    );
  }

  throw unsupportedValue("object", value);
}

function renderBufferedArray(
  values: readonly unknown[],
  startIndex: number,
  context: RenderContext,
  chunks: string[],
): BufferedResult {
  for (let index = startIndex; index < values.length; index++) {
    const pending = renderBufferedValue(values[index], context, chunks);
    if (pending) {
      return pending.then(() => {
        return renderBufferedArray(values, index + 1, context, chunks);
      });
    }
  }
}

function renderBufferedNode(
  node: HtmlNode,
  context: RenderContext,
  chunks: string[],
): BufferedResult {
  assertValidHtmlNode(node);

  switch (node.nodeType) {
    case "raw":
      chunks.push(node.value);
      return;
    case "escaped":
      return renderBufferedValue(node.value, context, chunks);
    case "attribute":
      emitAttributeWarning(node.name, node.value, context);
      chunks.push(serializeAttribute(node.name, node.value));
      return;
    case "fragment":
      return renderBufferedValue(node.children, context, chunks);
    case "template":
      return renderBufferedTemplate(node, 0, context, chunks);
    case "component":
      return renderBufferedComponent(node, context, chunks);
    case "element":
      return consumeRenderedGenerator(
        renderElement(node, context),
        context,
        chunks,
      );
    default:
      throw new RenderError("Received an unknown HTML instruction.");
  }
}

function renderBufferedTemplate(
  node: Extract<HtmlNode, { readonly nodeType: "template" }>,
  startIndex: number,
  context: RenderContext,
  chunks: string[],
): BufferedResult {
  for (let index = startIndex; index < node.values.length; index++) {
    chunks.push(node.strings[index]);
    const pending = renderBufferedValue(node.values[index], context, chunks);
    if (pending) {
      return pending.then(() => {
        return renderBufferedTemplate(node, index + 1, context, chunks);
      });
    }
  }
  chunks.push(node.strings[node.strings.length - 1]);
}

function renderBufferedComponent(
  node: ComponentNode,
  context: RenderContext,
  chunks: string[],
): BufferedResult {
  const frame: ComponentFrame = {
    name: node.component.name || "Anonymous",
    ...(node.source ? { source: node.source } : {}),
  };

  try {
    throwIfAborted(context.signal);
    const pending = renderBufferedValue(
      node.component(node.props),
      context,
      chunks,
    );
    return pending?.catch((error) => {
      throw frameComponentError(error, frame, context.signal);
    });
  } catch (error) {
    throw frameComponentError(error, frame, context.signal);
  }
}

async function consumeRenderedGenerator(
  generator: AsyncGenerator<RenderSegment, void, void>,
  context: RenderContext,
  chunks: string[],
): Promise<void> {
  for await (const chunk of generator) {
    throwIfAborted(context.signal);
    if (chunk !== STREAM_FLUSH) {
      chunks.push(chunk);
    }
  }
}

function frameComponentError(
  error: unknown,
  frame: ComponentFrame,
  signal: AbortSignal | undefined,
): unknown {
  return isAbortReason(error, signal) ? error : addComponentFrame(error, frame);
}

async function* renderValue(
  value: unknown,
  context: RenderContext,
): AsyncGenerator<RenderSegment, void, void> {
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

  const thenMethod = getThenMethod(value);
  if (thenMethod) {
    const resolved = await resolveAwaitable(value, thenMethod, context.signal);
    throwIfAborted(context.signal);
    yield* renderValue(resolved, context);
    return;
  }

  const asyncIteratorMethod = getIteratorMethod(
    value,
    Symbol.asyncIterator,
    "Symbol.asyncIterator",
  );
  if (asyncIteratorMethod) {
    yield* renderProtocolIterable(
      value,
      asyncIteratorMethod,
      true,
      context,
      renderValue,
    );
    return;
  }

  const iteratorMethod = getIteratorMethod(
    value,
    Symbol.iterator,
    "Symbol.iterator",
  );
  if (iteratorMethod) {
    yield* renderProtocolIterable(
      value,
      iteratorMethod,
      false,
      context,
      renderValue,
    );
    return;
  }

  throw unsupportedValue("object", value);
}

async function* renderNode(
  node: HtmlNode,
  context: RenderContext,
): AsyncGenerator<RenderSegment, void, void> {
  assertValidHtmlNode(node);

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
    case "template": {
      let chunk = node.strings[0];
      for (let index = 0; index < node.values.length; index++) {
        const immediate = renderImmediate(node.values[index], context);
        if (immediate === NOT_IMMEDIATE) {
          if (chunk.length > 0) {
            yield chunk;
          }
          yield* renderValue(node.values[index], context);
          chunk = "";
        } else {
          chunk += immediate;
        }
        chunk += node.strings[index + 1];
      }
      if (chunk.length > 0) {
        yield chunk;
      }
      return;
    }
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

function renderImmediate(
  value: unknown,
  context: RenderContext,
): string | typeof NOT_IMMEDIATE {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }

  switch (typeof value) {
    case "string":
      return escapeText(value);
    case "number":
    case "bigint":
      return String(value);
    case "function":
    case "symbol":
      return NOT_IMMEDIATE;
  }

  if (!isHtml(value)) {
    return NOT_IMMEDIATE;
  }

  switch (value.nodeType) {
    case "raw":
      try {
        assertValidHtmlNode(value);
        return value.value;
      } catch {
        return NOT_IMMEDIATE;
      }
    case "escaped": {
      try {
        assertValidHtmlNode(value);
      } catch {
        return NOT_IMMEDIATE;
      }
      const escaped = value.value;
      if (
        escaped !== null && escaped !== undefined &&
        typeof escaped === "object"
      ) {
        return NOT_IMMEDIATE;
      }
      return renderImmediate(escaped, context);
    }
    case "attribute": {
      // A warning callback is application code and can throw. Keep it on the
      // normal traversal path so a preceding prefix is observable first and
      // so fallback can never invoke the callback twice.
      if (context.onWarning) {
        return NOT_IMMEDIATE;
      }
      try {
        assertValidHtmlNode(value);
        const attributeValue = value.value;
        if (
          typeof attributeValue === "object" ||
          typeof attributeValue === "function" ||
          typeof attributeValue === "symbol"
        ) {
          return NOT_IMMEDIATE;
        }
        return serializeAttribute(value.name, attributeValue);
      } catch {
        // Serialization is pure for primitive values. Let normal traversal
        // reproduce the diagnostic after any preceding template prefix.
        return NOT_IMMEDIATE;
      }
    }
    default:
      return NOT_IMMEDIATE;
  }
}

function assertValidHtmlNode(node: HtmlNode): void {
  const instruction = node as unknown as Record<PropertyKey, unknown>;

  switch (instruction.nodeType) {
    case "raw":
      assertInstructionField(instruction, "value", "string");
      return;
    case "escaped":
      assertInstructionOwnField(instruction, "value");
      return;
    case "attribute":
      assertInstructionField(instruction, "name", "string");
      assertInstructionOwnField(instruction, "value");
      return;
    case "fragment":
      assertInstructionOwnField(instruction, "children");
      return;
    case "template":
      if (VALIDATED_TEMPLATE_NODES.has(instruction)) {
        return;
      }
      if (
        !Array.isArray(instruction.strings) ||
        !instruction.strings.every((value) => typeof value === "string") ||
        !Array.isArray(instruction.values) ||
        instruction.strings.length !== instruction.values.length + 1
      ) {
        throw malformedInstruction("template");
      }
      assertNoPrecompiledRawTextElements(instruction.strings);
      if (
        Object.isFrozen(instruction) &&
        Object.isFrozen(instruction.strings) &&
        Object.isFrozen(instruction.values)
      ) {
        VALIDATED_TEMPLATE_NODES.add(instruction);
      }
      return;
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

function assertInstructionOwnField(
  instruction: Record<PropertyKey, unknown>,
  field: string,
): void {
  if (!Object.hasOwn(instruction, field)) {
    throw malformedInstruction(String(instruction.nodeType));
  }
}

function assertInstructionField(
  instruction: Record<PropertyKey, unknown>,
  field: string,
  expectedType: "function" | "string",
): void {
  const valid = expectedType === "string"
    ? typeof instruction[field] === "string"
    : typeof instruction[field] === "function";
  if (!valid) {
    throw malformedInstruction(String(instruction.nodeType));
  }
}

function assertInstructionProps(
  instruction: Record<PropertyKey, unknown>,
  nodeType: "component" | "element",
): void {
  const props = instruction.props;
  if (typeof props !== "object" || props === null || !isPlainRecord(props)) {
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
  if (typeof source !== "object" || source === null || !isPlainRecord(source)) {
    throw malformedInstruction(nodeType);
  }

  const location = source as Record<PropertyKey, unknown>;
  if (
    (location.fileName !== undefined &&
      typeof location.fileName !== "string") ||
    (location.lineNumber !== undefined &&
      (typeof location.lineNumber !== "number" ||
        !Number.isFinite(location.lineNumber))) ||
    (location.columnNumber !== undefined &&
      (typeof location.columnNumber !== "number" ||
        !Number.isFinite(location.columnNumber)))
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

/**
 * Deno's precompile transform emits literal markup as template strings. Raw
 * text elements must instead reach `jsx()` so the renderer can enforce their
 * context-specific child policy. This small HTML-aware scan ignores quoted
 * attribute values and comments while rejecting actual opening tags.
 */
function assertNoPrecompiledRawTextElements(
  strings: readonly string[],
): void {
  // Almost every generated template takes this allocation-free path. A tag
  // name cannot contain a JSX interpolation, so only a candidate segment (or
  // one ending immediately after the name) needs the structural scan below.
  if (!strings.some((segment) => RAW_TEXT_OPENING_CANDIDATE.test(segment))) {
    return;
  }

  const markup = strings.join("");
  let index = 0;

  while (index < markup.length) {
    const opening = markup.indexOf("<", index);
    if (opening === -1) {
      return;
    }

    if (markup.startsWith("<!--", opening)) {
      const commentEnd = markup.indexOf("-->", opening + 4);
      if (commentEnd === -1) {
        // Be conservative around malformed/unclosed comments: a browser may
        // recover before a later tag even when this lightweight scan cannot.
        index = opening + 4;
        continue;
      }
      index = commentEnd + 3;
      continue;
    }

    const nameStart = opening + 1;
    const first = markup.charCodeAt(nameStart);
    if (isAsciiLetter(first)) {
      let nameEnd = nameStart + 1;
      while (isTagNameCodeUnit(markup.charCodeAt(nameEnd))) {
        nameEnd++;
      }

      const tagName = markup.slice(nameStart, nameEnd).toLowerCase();
      if (
        RAW_TEXT_ELEMENTS.has(tagName) &&
        isTagNameBoundary(markup.charCodeAt(nameEnd))
      ) {
        throw new RenderError(
          `Deno precompiled the <${tagName}> raw-text element. Configure \`"jsxPrecompileSkipElements": ["script", "style"]\` so @bastianplsfix/html can enforce raw-text escaping.`,
        );
      }

      index = skipStaticTag(markup, nameStart);
      continue;
    }

    if (first === 0x21 || first === 0x2f || first === 0x3f) {
      index = skipStaticTag(markup, nameStart);
      continue;
    }

    // An invalid tag opener is text. Keep scanning because a real tag can
    // follow before the next greater-than sign (`1 < 2 <script>`).
    index = opening + 1;
  }
}

function skipStaticTag(markup: string, start: number): number {
  let quote = 0;

  for (let index = start; index < markup.length; index++) {
    const codeUnit = markup.charCodeAt(index);
    if (quote !== 0) {
      if (codeUnit === quote) {
        quote = 0;
      }
      continue;
    }
    if (codeUnit === 0x22 || codeUnit === 0x27) {
      quote = codeUnit;
    } else if (codeUnit === 0x3e) {
      return index + 1;
    }
  }

  return markup.length;
}

function isAsciiLetter(codeUnit: number): boolean {
  return (codeUnit >= 0x41 && codeUnit <= 0x5a) ||
    (codeUnit >= 0x61 && codeUnit <= 0x7a);
}

function isTagNameCodeUnit(codeUnit: number): boolean {
  return isAsciiLetter(codeUnit) ||
    (codeUnit >= 0x30 && codeUnit <= 0x39) ||
    codeUnit === 0x2d || codeUnit === 0x2e || codeUnit === 0x3a ||
    codeUnit === 0x5f;
}

function isTagNameBoundary(codeUnit: number): boolean {
  return codeUnit === 0x09 || codeUnit === 0x0a || codeUnit === 0x0c ||
    codeUnit === 0x0d || codeUnit === 0x20 || codeUnit === 0x2f ||
    codeUnit === 0x3e;
}

async function* renderComponent(
  node: ComponentNode,
  context: RenderContext,
): AsyncGenerator<RenderSegment, void, void> {
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
): AsyncGenerator<RenderSegment, void, void> {
  const tagName = node.tagName;
  const children = node.props.children;
  const frame: ElementFrame = {
    name: tagName,
    ...(node.source ? { source: node.source } : {}),
  };
  let openingTag: string;
  let isVoid: boolean;

  try {
    assertValidTagName(tagName);
    isVoid = VOID_ELEMENTS.has(tagName.toLowerCase());
    if (isVoid && hasRenderableChildren(children)) {
      throw new RenderError(`Void element <${tagName}> cannot have children.`);
    }
    openingTag = serializeOpeningTag(node, context);
  } catch (error) {
    throw addElementFrame(error, frame);
  }

  yield openingTag;

  if (isVoid) {
    return;
  }

  if (RAW_TEXT_ELEMENTS.has(tagName.toLowerCase())) {
    try {
      yield* renderRawTextValue(children, context, tagName.toLowerCase());
    } catch (error) {
      if (context.signal?.aborted && error === context.signal.reason) {
        throw error;
      }
      throw addElementFrame(error, frame);
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
): AsyncGenerator<RenderSegment, void, void> {
  throwIfAborted(context.signal);

  if (value === null || value === undefined || typeof value === "boolean") {
    return;
  }

  if (isHtml(value)) {
    assertValidHtmlNode(value);
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

  if (typeof value === "object" && value !== null) {
    const thenMethod = getThenMethod(value);
    if (thenMethod) {
      const resolved = await resolveAwaitable(
        value,
        thenMethod,
        context.signal,
      );
      yield* renderRawTextValue(resolved, context, tagName);
      return;
    }

    const renderChild: ChildRenderer = (child, childContext) =>
      renderRawTextValue(child, childContext, tagName);
    const asyncIteratorMethod = getIteratorMethod(
      value,
      Symbol.asyncIterator,
      "Symbol.asyncIterator",
    );
    if (asyncIteratorMethod) {
      yield* renderProtocolIterable(
        value,
        asyncIteratorMethod,
        true,
        context,
        renderChild,
      );
      return;
    }

    const iteratorMethod = getIteratorMethod(
      value,
      Symbol.iterator,
      "Symbol.iterator",
    );
    if (iteratorMethod) {
      yield* renderProtocolIterable(
        value,
        iteratorMethod,
        false,
        context,
        renderChild,
      );
      return;
    }
  }

  throw rawTextChildError(tagName);
}

async function* renderRawTextComponent(
  node: ComponentNode,
  context: RenderContext,
  tagName: string,
): AsyncGenerator<RenderSegment, void, void> {
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

async function* renderProtocolIterable(
  value: object,
  iteratorFactory: ProtocolMethod,
  isAsync: boolean,
  context: RenderContext,
  renderChild: ChildRenderer,
): AsyncGenerator<RenderSegment, void, void> {
  let iterator: object | undefined;
  let completed = false;
  let primaryFailure: unknown | typeof NO_FAILURE = NO_FAILURE;

  try {
    const candidate = Reflect.apply(iteratorFactory, value, []);
    if (!isObjectLike(candidate)) {
      throw protocolTypeError("Iterator factory must return an object.");
    }
    iterator = candidate;

    const nextMethod = getRequiredProtocolMethod(iterator, "next");
    while (true) {
      throwIfAborted(context.signal);
      const nextResult = Reflect.apply(nextMethod, iterator, []);
      const result = isAsync
        ? await resolveAwaitable(nextResult, undefined, context.signal)
        : nextResult;
      throwIfAborted(context.signal);

      const step = readIteratorResult(result);
      if (step.done) {
        completed = true;
        return;
      }

      yield* renderChild(step.value, context);
      throwIfAborted(context.signal);
      if (isAsync) {
        // Do not request another async-iterator item until the consumer has
        // received the complete prefix produced by the current one.
        yield STREAM_FLUSH;
      }
    }
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    if (iterator && !completed) {
      await finishIteratorCleanup(
        iterator,
        isAsync,
        primaryFailure,
        context,
      );
    }
  }
}

async function finishIteratorCleanup(
  iterator: object,
  isAsync: boolean,
  primaryFailure: unknown | typeof NO_FAILURE,
  context: RenderContext,
): Promise<void> {
  const cleanup = closeProtocolIterator(iterator, isAsync);

  if (
    primaryFailure !== NO_FAILURE &&
    context.signal &&
    context.cleanupPolicy?.awaitOnAbort !== true
  ) {
    try {
      await waitForNativePromise(cleanup, context.signal);
    } catch (cleanupFailure) {
      if (isAbortReason(cleanupFailure, context.signal)) {
        // A later abort must not hide the failure that started IteratorClose.
        // The return hook was invoked; detach it and handle any later rejection.
        void cleanup.catch(() => {});
      }
      // IteratorClose never replaces the primary traversal failure.
    }
    return;
  }

  try {
    await cleanup;
  } catch (cleanupFailure) {
    if (primaryFailure === NO_FAILURE) {
      throw cleanupFailure;
    }
    // IteratorClose never replaces the failure that caused traversal to
    // unwind. This also composes across nested iterables.
  }
}

function hasRenderableChildren(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false &&
    value !== true;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

function yieldToHostTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

function getThenMethod(value: object): ProtocolMethod | undefined {
  const method = Reflect.get(value, "then") as unknown;
  return typeof method === "function" ? method as ProtocolMethod : undefined;
}

function getIteratorMethod(
  value: object,
  key: typeof Symbol.asyncIterator | typeof Symbol.iterator,
  label: string,
): ProtocolMethod | undefined {
  const method = Reflect.get(value, key) as unknown;
  if (method === null || method === undefined) {
    return undefined;
  }
  if (typeof method !== "function") {
    throw protocolTypeError(`${label} must be a function when present.`);
  }
  return method as ProtocolMethod;
}

function getRequiredProtocolMethod(
  value: object,
  name: "next",
): ProtocolMethod {
  const method = Reflect.get(value, name) as unknown;
  if (typeof method !== "function") {
    throw protocolTypeError(`Iterator ${name} must be a function.`);
  }
  return method as ProtocolMethod;
}

function readIteratorResult(
  result: unknown,
): { readonly done: true } | { readonly done: false; readonly value: unknown } {
  if (!isObjectLike(result)) {
    throw protocolTypeError("Iterator next() must return an object.");
  }
  if (!Reflect.has(result, "done")) {
    throw protocolTypeError("Iterator next() result must include done.");
  }

  const done = Reflect.get(result, "done") as unknown;
  if (typeof done !== "boolean") {
    throw protocolTypeError("Iterator next() result done must be a boolean.");
  }
  if (done) {
    return { done: true };
  }
  return { done: false, value: Reflect.get(result, "value") };
}

async function closeProtocolIterator(
  iterator: object,
  isAsync: boolean,
): Promise<void> {
  const returnMethod = Reflect.get(iterator, "return") as unknown;
  if (returnMethod === null || returnMethod === undefined) {
    return;
  }
  if (typeof returnMethod !== "function") {
    throw protocolTypeError("Iterator return must be a function when present.");
  }

  const returnResult = Reflect.apply(
    returnMethod as ProtocolMethod,
    iterator,
    [],
  );
  const result = isAsync
    ? await resolveAwaitable(returnResult, undefined, undefined)
    : returnResult;
  if (!isObjectLike(result)) {
    throw protocolTypeError("Iterator return() must return an object.");
  }
}

async function resolveAwaitable(
  value: unknown,
  knownThenMethod: ProtocolMethod | undefined,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  const seen = new Set<object>();
  let current = value;
  let thenMethod = knownThenMethod;

  while (isObjectLike(current)) {
    throwIfAborted(signal);
    thenMethod ??= getThenMethod(current);
    if (!thenMethod) {
      return current;
    }
    if (seen.has(current)) {
      throw protocolTypeError("Thenable resolution cycle detected.");
    }
    seen.add(current);

    const settlement = await waitForNativePromise(
      callThenOnce(current, thenMethod),
      signal,
    );
    throwIfAborted(signal);
    if (settlement.value === current) {
      throw protocolTypeError("Thenable cannot resolve to itself.");
    }

    current = settlement.value;
    thenMethod = undefined;
  }

  return current;
}

function callThenOnce(
  target: object,
  thenMethod: ProtocolMethod,
): Promise<{ readonly value: unknown }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fulfill = (value: unknown) => {
      if (!settled) {
        settled = true;
        // Wrapping prevents the native Promise implementation from recursively
        // assimilating a hostile or self-resolving thenable.
        resolve({ value });
      }
    };
    const rejectOnce = (reason: unknown) => {
      if (!settled) {
        settled = true;
        reject(reason);
      }
    };

    try {
      Reflect.apply(thenMethod, target, [fulfill, rejectOnce]);
    } catch (error) {
      rejectOnce(error);
    }
  });
}

function waitForNativePromise<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) {
    return promise;
  }

  signal.throwIfAborted();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
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

function isObjectLike(value: unknown): value is object {
  return (typeof value === "object" && value !== null) ||
    typeof value === "function";
}

function protocolTypeError(message: string): TypeError {
  return new TypeError(`Invalid render protocol: ${message}`);
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

async function pollIteratorNext(
  next: Promise<IteratorResult<RenderSegment, void>>,
): Promise<
  | { readonly ok: true; readonly result: IteratorResult<RenderSegment, void> }
  | { readonly ok: false; readonly error: unknown }
  | typeof NEXT_NOT_READY
> {
  let outcome:
    | {
      readonly ok: true;
      readonly result: IteratorResult<RenderSegment, void>;
    }
    | { readonly ok: false; readonly error: unknown }
    | undefined;

  void next.then(
    (result) => {
      outcome = { ok: true, result };
    },
    (error) => {
      outcome = { ok: false, error };
    },
  );

  for (let turn = 0; turn < STREAM_READY_MICROTASKS; turn++) {
    await Promise.resolve();
    if (outcome) {
      return outcome;
    }
  }
  return NEXT_NOT_READY;
}

function concatenateBytes(
  first: Uint8Array,
  second: Uint8Array,
): Uint8Array {
  if (first.byteLength === 0) {
    return second;
  }
  if (second.byteLength === 0) {
    return first;
  }

  const bytes = new Uint8Array(first.byteLength + second.byteLength);
  bytes.set(first);
  bytes.set(second, first.byteLength);
  return bytes;
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
    // Function names are properties and can be trapped by a Proxy.
    return "[Function]";
  }

  if (typeof value === "symbol") {
    const description = value.description;
    return description === undefined
      ? "Symbol()"
      : `Symbol(${quoteDiagnosticText(description)})`;
  }

  if (typeof value === "object" && value !== null) {
    if (isNativeError(value)) {
      // Error.isError rejects Proxy wrappers. Reading a data descriptor from a
      // branded native Error therefore cannot invoke an application getter.
      const message = Object.getOwnPropertyDescriptor(value, "message");
      if (typeof message?.value === "string" && message.value.length > 0) {
        return `[Error: ${quoteDiagnosticText(message.value)}]`;
      }
      return "[Error]";
    }

    try {
      if (Array.isArray(value)) {
        return "[Array]";
      }
    } catch {
      // A revoked Proxy cannot be inspected, even by Array.isArray.
    }

    // Do not enumerate, serialize, inspect prototypes, or read toStringTag:
    // all of those operations can execute user code on ordinary objects.
    return "[Object]";
  }

  return truncateDiagnosticText(String(value));
}

function isNativeError(value: object): boolean {
  const brandCheck = (
    Error as ErrorConstructor & {
      readonly isError?: (candidate: unknown) => boolean;
    }
  ).isError;
  return typeof brandCheck === "function" && brandCheck(value);
}

function quoteDiagnosticText(value: string): string {
  return JSON.stringify(truncateDiagnosticText(value));
}

function truncateDiagnosticText(value: string): string {
  if (value.length <= DIAGNOSTIC_VALUE_CODE_UNITS) {
    return value;
  }
  return `${value.slice(0, DIAGNOSTIC_VALUE_CODE_UNITS - 1)}…`;
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

  return new RenderError(describeFailure(error), [frame], { cause: error });
}

function addElementFrame(error: unknown, frame: ElementFrame): RenderError {
  if (error instanceof RenderError) {
    if (error.element) {
      return error;
    }
    return new RenderError(
      error.detail,
      error.componentStack,
      { cause: error.cause ?? error, element: frame },
    );
  }

  if (error instanceof Error) {
    return new RenderError(error.message, [], { cause: error, element: frame });
  }

  return new RenderError(describeFailure(error), [], {
    cause: error,
    element: frame,
  });
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
    sections.push(
      `Component stack:\n${componentStack.map(formatFrame).join("\n")}`,
    );
  }

  return sections.join("\n\n");
}

function formatFrame(frame: ComponentFrame | ElementFrame): string {
  return `  at <${frame.name}>${formatSourceLocation(frame.source)}`;
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
  return new RenderError(describeFailure(error), [], { cause: error });
}

function describeFailure(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "Rendering failed with a non-Error value.";
  }
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
