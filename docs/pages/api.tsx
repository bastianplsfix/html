import type { Html } from "@bastianplsfix/html";
import { ApiEntry, Callout, PageHeader } from "../components/mod.ts";

/** Public 0.1 API reference. */
export function ApiPage(): Html {
  return (
    <article class="prose-page api-page">
      <PageHeader
        title="API reference"
        lead="The 0.1 surface is intentionally compact: values, ordered renderers, and explicit trust helpers."
      />

      <div class="import-path">
        <span>Primary import</span>
        <code>jsr:@bastianplsfix/html@^0.1.0</code>
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
          Resolves a complete renderable tree into one HTML string. An optional
          <code>AbortSignal</code>{" "}
          stops traversal when the request is cancelled. Supply
          <code>onWarning</code>{" "}
          to receive structured, non-fatal security diagnostics.
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
          Produces ordered UTF-8 HTML chunks on demand. Stream cancellation
          closes active iterators. Errors after delivery starts error the stream
          because the response status and headers may already be committed. It
          accepts the same signal and warning options as buffered rendering.
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
          <code>&amp;</code>, U+2028, and U+2029.
        </p>
      </ApiEntry>

      <ApiEntry
        name="RenderError"
        signature={[
          "class RenderError extends Error {",
          "  readonly detail: string;",
          "  readonly element?: ElementFrame;",
          "  readonly componentStack: readonly ComponentFrame[];",
          "}",
        ].join("\n")}
      >
        <p>
          Normalized renderer failure with structured intrinsic-element source
          information and the server-component path that produced it.
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
          <code>@bastianplsfix/html/response</code>. Creates a Web Standard
          response immediately and renders its body as ordered UTF-8 chunks.
          Pass the request signal through <code>init.signal</code> so aborted
          requests stop traversal.
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

      <Callout title="Streaming contract">
        <p>
          Chunk boundaries are deliberately unspecified. Streaming preserves the
          same escaping and traversal order as <code>renderToString()</code>, but
          callers cannot replace an HTTP response after its first bytes are sent.
        </p>
      </Callout>
    </article>
  );
}
