import type { Html } from "@bastianplsfix/html";
import { CodeBlock, Pipeline } from "../components/mod.ts";
import { HELLO_CODE } from "../content/examples.ts";

/** Product overview and landing page. */
export function HomePage(): Html {
  return (
    <>
      <section class="hero">
        <div class="hero-copy">
          <h1>
            HTML is the output.<br />
            <em>Not a runtime.</em>
          </h1>
          <p class="hero-lead">
            Build typed server templates with ordinary TypeScript. No virtual
            DOM, hydration, hooks, or browser bundle—just safe HTML strings and
            streams.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="/getting-started">
              Get started
            </a>
            <a class="button button-secondary" href="/concepts">
              Read the concepts
            </a>
          </div>
        </div>
        <CodeBlock code={HELLO_CODE} filename="page.tsx" />
      </section>

      <section class="pipeline-section" aria-labelledby="pipeline-title">
        <div>
          <h2 id="pipeline-title">A small, visible boundary</h2>
        </div>
        <Pipeline />
      </section>

      <section class="feature-grid" aria-label="Framework principles">
        <article class="feature-card feature-card-accent">
          <span class="feature-number">01</span>
          <h2>Secure values</h2>
          <p>
            Strings are text. Only branded framework instructions can become
            markup, and bypassing escaping is deliberately explicit.
          </p>
          <a href="/security">Explore the security model →</a>
        </article>
        <article class="feature-card">
          <span class="feature-number">02</span>
          <h2>Async-native</h2>
          <p>
            Components can return promises, iterables, or async iterables. The
            renderer resolves everything in document order.
          </p>
          <a href="/concepts#async">Understand async rendering →</a>
        </article>
        <article class="feature-card">
          <span class="feature-number">03</span>
          <h2>HTML-native types</h2>
          <p>
            Write <code>class</code>, <code>for</code>, and{" "}
            <code>readonly</code>. Client events and React-specific vocabulary
            stay out.
          </p>
          <a href="/concepts#attributes">See attribute semantics →</a>
        </article>
      </section>

      <section class="manifesto">
        <blockquote>
          “The renderer describes HTML. The route decides what that HTML means
          over HTTP.”
        </blockquote>
        <p>
          Routing, sessions, asset pipelines, status codes, and redirects remain
          application concerns. The core stays useful everywhere a Web Standard
          <code>Response</code> is accepted.
        </p>
      </section>
    </>
  );
}
