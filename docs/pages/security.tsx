import type { Html } from "@bastianplsfix/html";
import { Callout, CodeBlock, PageHeader } from "../components/mod.ts";
import {
  ATTRIBUTE_CODE,
  ESCAPING_CODE,
  JSON_CODE,
  UNSAFE_CODE,
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
        </p>
        <CodeBlock code={ATTRIBUTE_CODE} filename="form.tsx" />
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
          element.
        </p>
        <CodeBlock code={JSON_CODE} filename="document.tsx" />
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
