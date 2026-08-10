import type { Html } from "@bastianplsfix/html";
import { Callout, CodeBlock, PageHeader } from "../components/mod.ts";
import {
  ATTRIBUTE_CODE,
  ESCAPING_CODE,
  JSON_CODE,
  RAW_TEXT_CODE,
  UNSAFE_CODE,
  WARNING_CODE,
} from "../content/examples.ts";

/** Security guarantees and explicit trust boundaries. */
export function SecurityPage(): Html {
  return (
    <article class="prose-page">
      <PageHeader
        title="Security model"
        lead="User values are text unless a callsite explicitly marks them as trusted HTML."
      />

      <section id="text">
        <h2>Text is escaped automatically</h2>
        <p>
          A string returned by a component and a string interpolated into TSX
          have the same meaning: text. HTML-looking input cannot create
          elements.
        </p>
        <CodeBlock code={ESCAPING_CODE} filename="search-results.tsx" />
      </section>

      <section id="attributes">
        <h2>Attributes have their own context</h2>
        <p>
          Dynamic attribute values are validated and escaped for a double-quoted
          attribute context. Spread attribute names are validated as well.
          Dynamic <code>on*</code>{" "}
          attributes are rejected case-insensitively because browsers execute
          their decoded values as JavaScript.
        </p>
        <CodeBlock code={ATTRIBUTE_CODE} filename="form.tsx" />
        <p>
          Dynamic <code>srcdoc</code>{" "}
          is rejected too: the browser decodes that attribute and parses its
          value as a nested HTML document, so ordinary attribute escaping is not
          a sufficient boundary.
        </p>
      </section>

      <section id="unsafe-html">
        <h2>Trusted markup is deliberately loud</h2>
        <p>
          Use <code>unsafeHTML()</code>{" "}
          only after establishing trust—for example, after sanitizing output
          from a Markdown renderer. The helper performs no sanitization itself.
        </p>
        <CodeBlock code={UNSAFE_CODE} filename="article.tsx" />
        <Callout title="This is a trust assertion" tone="warning">
          <p>
            Passing user-controlled input to <code>unsafeHTML()</code>{" "}
            defeats the framework's central safety invariant. Keep the call
            close to the code that establishes trust.
          </p>
        </Callout>
      </section>

      <section id="json">
        <h2>JSON needs a raw-text helper</h2>
        <p>
          A script element is not an ordinary HTML text context. Use
          <code>scriptJSON()</code>{" "}
          to serialize data and neutralize characters that could close the
          element. It follows JSON serialization rules and throws for values
          such as cycles and bigints.
        </p>
        <CodeBlock code={JSON_CODE} filename="document.tsx" />
      </section>

      <section id="raw-text">
        <h2>Script and style children are strict</h2>
        <p>
          Keep <code>script</code> and <code>style</code> in{" "}
          <code>jsxPrecompileSkipElements</code>. The runtime then rejects plain
          strings and ordinary renderable instructions inside those raw-text
          elements.
        </p>
        <CodeBlock code={RAW_TEXT_CODE} filename="document.tsx" />
        <Callout title="Trust is context-specific" tone="warning">
          <p>
            Removing either compiler skip makes Deno emit an unsupported
            precompiled raw-text template. The renderer rejects that shape
            rather than emitting it, but the skip configuration is still
            required for raw-text elements.
          </p>
          <p>
            <code>unsafeHTML()</code>{" "}
            performs no HTML, JavaScript, or CSS sanitization. A value trusted
            as HTML is not automatically safe as script or stylesheet source.
            Use it here only when the exact raw-text source is already trusted.
          </p>
        </Callout>
      </section>

      <section id="urls">
        <h2>Escaping is not URL sanitization</h2>
        <p>
          HTML escaping prevents an attribute breakout, but a correctly escaped
          <code>javascript:</code>{" "}
          URL can still be dangerous. Validate schemes and destinations
          according to your application's URL policy before rendering
          user-controlled links.
        </p>
        <CodeBlock code={WARNING_CODE} filename="render.tsx" />
        <p>
          Both renderers can pass immutable diagnostics for dynamic
          <code>javascript:</code> and <code>vbscript:</code> schemes to{" "}
          <code>onWarning</code>, including common control-character disguises.
          The renderer leaves the URL unchanged.
        </p>
        <Callout title="Warnings do not sanitize">
          <p>
            Log warnings during development, or throw from the callback to make
            them fatal. Either way, define an application allowlist for schemes
            and destinations instead of treating the callback as validation.
          </p>
        </Callout>
        <p>
          The same principle applies beyond URL schemes. Escaping does not make
          user-controlled CSS in{" "}
          <code>style</code>, custom-element semantics, SVG animation values, or
          active <code>data:</code>{" "}
          payloads safe. Validate every browser-interpreted value according to
          its destination context.
        </p>
      </section>

      <nav class="next-page" aria-label="Next documentation page">
        <span>Next</span>
        <a href="/api">
          API reference <span aria-hidden="true">→</span>
        </a>
      </nav>
    </article>
  );
}
