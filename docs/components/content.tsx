import type { Children, Html } from "@bastianplsfix/html";

interface PageHeaderProps {
  readonly title: string;
  readonly lead: string;
}

/** Heading block used at the beginning of documentation pages. */
export function PageHeader(
  { title, lead }: PageHeaderProps,
): Html {
  return (
    <header class="page-header">
      <h1>{title}</h1>
      <p class="lead">{lead}</p>
    </header>
  );
}

interface CodeBlockProps {
  readonly code: string;
  readonly language?: string;
  readonly filename?: string;
}

/** Escaped source-code example with an optional filename label. */
export function CodeBlock(
  { code, language = "tsx", filename }: CodeBlockProps,
): Html {
  return (
    <figure class="code-block">
      <figcaption>
        <span>{filename ?? language}</span>
        <span class="code-language">{language}</span>
      </figcaption>
      <pre data-language={language}><code>{code}</code></pre>
    </figure>
  );
}

interface CalloutProps {
  readonly title: string;
  readonly tone?: "note" | "warning";
  readonly children: Children;
}

/** Supplemental note used to highlight an important rendering invariant. */
export function Callout(
  { title, tone = "note", children }: CalloutProps,
): Html {
  return (
    <aside class={`callout callout-${tone}`}>
      <p class="callout-title">{title}</p>
      <div>{children}</div>
    </aside>
  );
}

interface ApiEntryProps {
  readonly name: string;
  readonly signature: string;
  readonly children: Children;
}

/** One function or type in the API reference. */
export function ApiEntry(
  { name, signature, children }: ApiEntryProps,
): Html {
  return (
    <section class="api-entry" id={name}>
      <div class="api-heading">
        <h2>
          <code>{name}</code>
        </h2>
        <a href={`#${name}`} aria-label={`Link to ${name}`}>#</a>
      </div>
      <pre class="signature"><code>{signature}</code></pre>
      <div class="api-copy">{children}</div>
    </section>
  );
}

/** Visual representation of the framework's one-way rendering pipeline. */
export function Pipeline(): Html {
  return (
    <div class="pipeline" aria-label="TSX to Response rendering pipeline">
      <div>
        <strong>TSX</strong>
        <span>authoring</span>
      </div>
      <span aria-hidden="true">→</span>
      <div>
        <strong>Html</strong>
        <span>instructions</span>
      </div>
      <span aria-hidden="true">→</span>
      <div>
        <strong>string / stream</strong>
        <span>rendering</span>
      </div>
      <span aria-hidden="true">→</span>
      <div>
        <strong>Response</strong>
        <span>HTTP</span>
      </div>
    </div>
  );
}
