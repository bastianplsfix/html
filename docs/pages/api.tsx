import type { Html } from "@bastianplsfix/html";
import { ApiEntry, Callout, PageHeader } from "../components/mod.ts";

/** Public 0.1 API reference. */
export function ApiPage(): Html {
  return (
    <article class="prose-page api-page">
      <PageHeader
        title="API reference"
        lead="The 0.1 surface is intentionally compact: values, one buffered renderer, and explicit trust helpers."
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
          stops traversal when the request is cancelled.
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
        name="html"
        signature={[
          "function html(",
          "  view: Renderable,",
          "  init?: ResponseInit,",
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

      <Callout title="Planned, not public yet">
        <p>
          <code>renderToStream()</code>{" "}
          is intentionally absent while buffered escaping, component, and error
          semantics settle. The instruction model already preserves the ordered
          traversal it will need.
        </p>
      </Callout>
    </article>
  );
}
