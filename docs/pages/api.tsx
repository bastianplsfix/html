import type { Html } from "@bastianplsfix/html";
import { ApiEntry, Callout, PageHeader } from "../components/mod.ts";

/** Public API reference. */
export function ApiPage(): Html {
  return (
    <article class="prose-page api-page">
      <PageHeader
        title="API reference"
        lead="The surface stays compact: one value model, buffered and streaming renderers, and explicit trust helpers."
      />

      <div class="import-path">
        <span>Primary import</span>
        <code>jsr:@bastianplsfix/html@^0.2.0</code>
      </div>

      <ApiEntry
        name="renderToString"
        signature={[
          "function renderToString(",
          "  view: Renderable,",
          "  options?: RenderOptions,",
          "): Promise<string>",
        ].join("\n")}
      >
        <p>
          Resolves a complete renderable tree into one HTML string. Rendering
          errors reject the promise before an HTTP response needs to be
          committed.
        </p>
      </ApiEntry>

      <ApiEntry
        name="renderToStream"
        signature={[
          "function renderToStream(",
          "  view: Renderable,",
          "  options?: RenderOptions,",
          "): ReadableStream<Uint8Array>",
        ].join("\n")}
      >
        <p>
          Produces ordered UTF-8 chunks. Traversal follows consumer demand, and
          cancellation attempts to close active iterators. Signal aborts remain
          prompt, while reader cancellation waits for finite asynchronous
          cleanup. Rendering errors after bytes have been consumed surface as
          stream errors.
        </p>
      </ApiEntry>

      <ApiEntry
        name="RenderOptions"
        signature={[
          "interface RenderOptions {",
          "  readonly signal?: AbortSignal;",
          "  readonly onWarning?: (warning: RenderWarning) => void;",
          "}",
        ].join("\n")}
      >
        <p>
          Shared by both renderers. The signal stops traversal. The warning
          callback receives dangerous dynamic URL diagnostics without rewriting
          output; throw from the callback if application policy should make one
          fatal.
        </p>
      </ApiEntry>

      <ApiEntry
        name="RenderWarning"
        signature={[
          "interface RenderWarning {",
          '  readonly code: "dangerous-url-scheme";',
          "  readonly attributeName: string;",
          '  readonly scheme: "javascript" | "vbscript";',
          "  readonly value: string;",
          "  readonly message: string;",
          "}",
        ].join("\n")}
      >
        <p>
          An immutable security diagnostic. It is intended for development
          visibility and does not replace application URL validation.
        </p>
      </ApiEntry>

      <ApiEntry name="doctype" signature="function doctype(): Html">
        <p>Returns the trusted HTML5 doctype instruction.</p>
      </ApiEntry>

      <ApiEntry
        name="unsafeHTML"
        signature="function unsafeHTML(value: string): Html"
      >
        <p>
          Marks a string as trusted markup and bypasses escaping. It does not
          sanitize the input.
        </p>
      </ApiEntry>

      <ApiEntry
        name="scriptJSON"
        signature="function scriptJSON(value: unknown): Html"
      >
        <p>
          Serializes JSON for a script raw-text context, escaping
          <code>&lt;</code>, <code>&gt;</code>,{" "}
          <code>&amp;</code>, U+2028, and U+2029. Values unsupported by JSON,
          including cycles and bigints, throw.
        </p>
      </ApiEntry>

      <ApiEntry
        name="html"
        signature={[
          "function html(",
          "  view: Renderable,",
          "  init?: HtmlResponseInit,",
          "): Promise<Response>",
        ].join("\n")}
      >
        <p>
          Available from{" "}
          <code>@bastianplsfix/html/response</code>. Buffers a view into a Web
          Standard response and supplies the HTML content type unless the caller
          already set one.
        </p>
      </ApiEntry>

      <ApiEntry
        name="streamHtml"
        signature={[
          "function streamHtml(",
          "  view: Renderable,",
          "  init?: HtmlResponseInit,",
          "): Response",
        ].join("\n")}
      >
        <p>
          Available from{" "}
          <code>@bastianplsfix/html/response</code>. Creates a response
          immediately and exposes rendering failures through its body stream.
          {" "}
          <code>HtmlResponseInit</code> combines standard response options with
          {" "}
          <code>signal</code> and <code>onWarning</code>.
        </p>
      </ApiEntry>

      <ApiEntry
        name="RenderError"
        signature={[
          "class RenderError extends Error {",
          "  readonly detail: string;",
          "  readonly componentStack: readonly ComponentFrame[];",
          "  readonly element?: ElementFrame;",
          "}",
        ].join("\n")}
      >
        <p>
          Normalizes rendering failures while retaining their original
          <code>cause</code>, component frames, and intrinsic-element context.
          Abort reasons are preserved directly instead of being wrapped.
        </p>
      </ApiEntry>

      <ApiEntry
        name="Renderable"
        signature={[
          "type Renderable = Html | string | number | bigint | boolean",
          "  | null | undefined",
          "  | Iterable<Renderable>",
          "  | AsyncIterable<Renderable>",
          "  | PromiseLike<Renderable>",
        ].join("\n")}
      >
        <p>The recursive value model accepted by components and renderers.</p>
      </ApiEntry>

      <ApiEntry
        name="Component"
        signature={[
          "type Component<Props = Record<never, never>> = (",
          "  props: Props & { readonly children?: Children },",
          ") => Renderable",
        ].join("\n")}
      >
        <p>A deferred server component with no instances or lifecycle.</p>
      </ApiEntry>

      <ApiEntry
        name="IntrinsicElementProps"
        signature="type IntrinsicElementProps<Tag> = JSX.IntrinsicElements[Tag]"
      >
        <p>
          Returns the generated props for one intrinsic tag. Use it when a
          wrapper component should accept the same server-native attributes as
          an element such as <code>button</code> or <code>svg</code>.
        </p>
      </ApiEntry>

      <ApiEntry
        name="CustomElementProps"
        signature="type CustomElementProps<Props extends object> = ..."
      >
        <p>
          Constrains an application's custom-element augmentation to
          serializable attributes. Add a concrete tag to the JSX runtime's
          <code>IntrinsicElements</code>{" "}
          interface; function values, objects, inline <code>on*</code>{" "}
          handlers, and <code>srcdoc</code> remain rejected.
        </p>
      </ApiEntry>

      <Callout title="Choose the response boundary deliberately">
        <p>
          <code>renderToString()</code>{" "}
          lets a handler choose an error response before sending bytes.
          <code>renderToStream()</code>{" "}
          provides backpressure and progressive output, but a later failure
          cannot change an already committed status or header.
        </p>
      </Callout>
    </article>
  );
}
