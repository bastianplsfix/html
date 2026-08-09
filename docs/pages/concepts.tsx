import type { Html } from "@bastianplsfix/html";
import { Callout, CodeBlock, PageHeader } from "../components/mod.ts";
import { ASYNC_CODE, COMPONENT_CODE } from "../content/examples.ts";

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
          buffered rendering they are awaited exactly where they occur.
        </p>
        <CodeBlock code={ASYNC_CODE} filename="user-badge.tsx" />
        <Callout title="Ordering is deterministic">
          <p>
            Arrays, generators, promises, and async generators are flattened in
            document order. This same instruction model is the foundation for a
            future ordered streaming renderer.
          </p>
        </Callout>
      </section>

      <section id="attributes">
        <h2>Server-oriented attributes</h2>
        <p>Attributes follow native HTML names and serialization rules:</p>
        <ul>
          <li>
            <code>null</code>, <code>undefined</code>, and <code>false</code>
            {" "}
            omit an attribute.
          </li>
          <li>
            <code>true</code> produces a bare boolean attribute.
          </li>
          <li>Strings and numbers become escaped quoted values.</li>
          <li>Objects, symbols, and functions throw.</li>
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
