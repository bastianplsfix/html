import type { Html } from "@bastianplsfix/html";
import { Callout, CodeBlock, PageHeader } from "../components/mod.ts";
import {
  ASYNC_CODE,
  COMPONENT_CODE,
  DEV_CONFIG_CODE,
  STREAM_CODE,
} from "../content/examples.ts";

/** Explanation of values, deferred components, async traversal, and attributes. */
export function ConceptsPage(): Html {
  return (
    <article class="prose-page">
      <PageHeader
        title="Core concepts"
        lead="The framework is an ordered renderer over a deliberately small value model."
      />

      <section id="values">
        <h2>Renderable values</h2>
        <p>
          Every child resolves to text, a trusted <code>Html</code>{" "}
          instruction, nothing, or another sequence of renderable values.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Value</th>
                <th scope="col">Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>string</code>, numbers
                </td>
                <td>Escaped text</td>
              </tr>
              <tr>
                <td>
                  <code>Html</code>
                </td>
                <td>Trusted instructions</td>
              </tr>
              <tr>
                <td>Nullish values, booleans</td>
                <td>No output</td>
              </tr>
              <tr>
                <td>Iterable</td>
                <td>Flatten recursively</td>
              </tr>
              <tr>
                <td>Promise</td>
                <td>Await, then render</td>
              </tr>
              <tr>
                <td>Object or function</td>
                <td>Descriptive error</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Trusted component libraries can exchange <code>Html</code>{" "}
          instructions across compatible package copies through the version-one
          runtime protocol. Unknown or malformed instructions are rejected. The
          protocol prevents accidental value confusion; it is not a sandbox for
          hostile code already running in the process.
        </p>
      </section>

      <section id="components">
        <h2>Components are deferred functions</h2>
        <p>
          A function component receives typed props and returns any renderable
          value. JSX stores the function and props in an instruction; the
          renderer invokes it later.
        </p>
        <CodeBlock code={COMPONENT_CODE} filename="greeting.tsx" />
        <p>
          There are no component instances, lifecycle methods, hooks, refs, or
          reconciliation rules. TypeScript control flow is the template
          language.
        </p>
      </section>

      <section id="async">
        <h2>Async is part of the value model</h2>
        <p>
          Promise-returning components need no wrapper or special syntax. During
          both buffered and streaming rendering they are awaited exactly where
          they occur.
        </p>
        <CodeBlock code={ASYNC_CODE} filename="user-badge.tsx" />
        <Callout title="Ordering is deterministic">
          <p>
            Arrays, generators, promises, and async generators are flattened in
            document order. Streaming never reveals a later component before an
            earlier one has resolved.
          </p>
        </Callout>
      </section>

      <section id="streaming">
        <h2>Streaming is explicit</h2>
        <p>
          <code>renderToStream()</code> returns a Web Standard{" "}
          <code>ReadableStream&lt;Uint8Array&gt;</code>. Traversal advances when
          the consumer pulls, so stream backpressure also controls renderer
          progress.
        </p>
        <CodeBlock code={STREAM_CODE} filename="main.tsx" />
        <p>
          Cancelling the reader or aborting the supplied signal stops traversal
          and attempts to close active iterators. Cancellation is cooperative:
          the renderer stops waiting for pending work, while the work itself
          should observe the same signal when it needs to stop. Signal aborts
          stay prompt. Reader cancellation waits for finite iterator cleanup, so
          it remains pending if an iterator's <code>return()</code>{" "}
          never settles.
        </p>
        <Callout title="The response may already be committed">
          <p>
            A rendering error after the first chunk becomes a stream error; the
            handler can no longer replace the response status or headers. Use
            <code>renderToString()</code>{" "}
            when catching every rendering error before returning a response is
            more important.
          </p>
        </Callout>
      </section>

      <section id="diagnostics">
        <h2>Development source locations</h2>
        <p>
          Component errors retain component names under every transform. File,
          line, and column details appear only when the JSX transform supplies
          them. Use a separate development configuration with
          <code>react-jsxdev</code> when source locations matter:
        </p>
        <CodeBlock
          code={DEV_CONFIG_CODE}
          language="json"
          filename="deno.dev.json"
        />
        <p>
          Deno's optimized <code>precompile</code>{" "}
          transform does not currently provide source locations to this runtime.
        </p>
      </section>

      <section id="attributes">
        <h2>Server-oriented attributes</h2>
        <p>Attributes follow native HTML names and serialization rules:</p>
        <ul>
          <li>
            <code>null</code> and <code>undefined</code> omit an attribute.
          </li>
          <li>
            Presence attributes render bare for <code>true</code>{" "}
            and are omitted for <code>false</code>.
          </li>
          <li>
            Enumerated boolean-like attributes such as <code>draggable</code>
            {" "}
            serialize booleans as quoted <code>true</code> or <code>false</code>
            {" "}
            tokens.
          </li>
          <li>Strings and numbers become escaped quoted values.</li>
          <li>Objects, symbols, and functions throw.</li>
          <li>
            Dynamic <code>on*</code> and <code>srcdoc</code>{" "}
            attributes are rejected at runtime.
          </li>
          <li>
            <code>data-*</code>,{" "}
            <code>aria-*</code>, SVG, and custom elements are typed.
          </li>
        </ul>
        <CodeBlock code='<input class="field" readonly required={false} value={value} />' />
      </section>

      <nav class="next-page" aria-label="Next documentation page">
        <span>Next</span>
        <a href="/security">
          Security model <span aria-hidden="true">→</span>
        </a>
      </nav>
    </article>
  );
}
