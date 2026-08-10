import type { Html } from "@bastianplsfix/html";
import { Callout, CodeBlock, PageHeader } from "../components/mod.ts";
import { CONFIG_CODE, HELLO_CODE, SERVER_CODE } from "../content/examples.ts";

/** Installation and first-server walkthrough. */
export function GettingStartedPage(): Html {
  return (
    <article class="prose-page">
      <PageHeader
        title="Getting started"
        lead="Go from an empty Deno project to a rendered TSX response in three small steps."
      />

      <section id="install">
        <h2>
          <span>01</span> Configure the JSX runtime
        </h2>
        <p>
          Add the package and select Deno's server-oriented precompile
          transform. Keep <code>script</code> and <code>style</code>{" "}
          as runtime elements so their raw-text contexts remain explicit.
        </p>
        <CodeBlock code={CONFIG_CODE} language="json" filename="deno.json" />
        <Callout title="Security-critical configuration" tone="warning">
          <p>
            Do not remove <code>script</code> or <code>style</code> from{" "}
            <code>jsxPrecompileSkipElements</code>. Deno can otherwise compile
            raw-text contents into a static template before normal child
            validation. The renderer rejects that shape defensively; restore the
            required skips to render the element safely.
          </p>
        </Callout>
        <p>
          The configuration also disables Deno's <code>jsx-key</code>{" "}
          rule. This renderer never reconciles component lists, so keys have no
          server-side meaning.
        </p>
      </section>

      <section id="view">
        <h2>
          <span>02</span> Write a view
        </h2>
        <p>
          TSX creates immutable <code>Html</code>{" "}
          instructions. Nothing touches a DOM, and components are not invoked
          until rendering begins.
        </p>
        <CodeBlock code={HELLO_CODE} filename="page.tsx" />
      </section>

      <section id="serve">
        <h2>
          <span>03</span> Return a Response
        </h2>
        <p>
          The optional response adapter sets the HTML content type while leaving
          HTTP routing and status decisions in your request handler.
        </p>
        <CodeBlock code={SERVER_CODE} filename="main.tsx" />
        <p>Start the server with:</p>
        <CodeBlock code="deno serve main.tsx" language="shell" />
      </section>

      <Callout title="Choose when the response commits">
        <p>
          <code>renderToString()</code>{" "}
          finishes before a response is returned. If a component fails, your
          handler can still choose a different status code or render an error
          page.
        </p>
        <p>
          Use <code>renderToStream()</code>{" "}
          explicitly for ordered, backpressure-aware output when that benefit is
          worth committing the status before the complete view has rendered.
        </p>
      </Callout>

      <nav class="next-page" aria-label="Next documentation page">
        <span>Next</span>
        <a href="/concepts">
          Core concepts <span aria-hidden="true">→</span>
        </a>
      </nav>
    </article>
  );
}
