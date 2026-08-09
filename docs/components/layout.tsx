import { type Children, doctype, type Html } from "@bastianplsfix/html";

interface NavItem {
  readonly href: string;
  readonly label: string;
}

interface NavSection {
  readonly label: string;
  readonly items: readonly NavItem[];
}

const NAVIGATION: readonly NavSection[] = [
  {
    label: "Start here",
    items: [
      { href: "/", label: "Overview" },
      { href: "/getting-started", label: "Getting started" },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/concepts", label: "Core concepts" },
      { href: "/security", label: "Security model" },
    ],
  },
  {
    label: "Reference",
    items: [{ href: "/api", label: "API reference" }],
  },
];

interface DocsLayoutProps {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly children: Children;
}

/** Shared document shell for every documentation route. */
export function DocsLayout(
  { title, description, path, children }: DocsLayoutProps,
): Html {
  const documentTitle = path === "/"
    ? "@bastianplsfix/html — typed TSX templates for Deno"
    : `${title} — @bastianplsfix/html`;

  return (
    <>
      {doctype()}
      <html lang="en" class="light">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <meta name="description" content={description} />
          <meta name="color-scheme" content="light" />
          <meta name="theme-color" content="#ffffff" />
          <title>{documentTitle}</title>
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href="/styles.css?v=light" />
        </head>
        <body>
          <a class="skip-link" href="#content">Skip to content</a>
          <SiteHeader />
          <div class="docs-shell">
            <aside class="sidebar">
              <nav aria-label="Documentation">{renderNavigation(path)}</nav>
              <div class="sidebar-note">
                <span class="status-dot" aria-hidden="true"></span>
                <span>0.2</span>
              </div>
            </aside>
            <main id="content" class="docs-content">
              {children}
              <DocsFooter />
            </main>
          </div>
        </body>
      </html>
    </>
  );
}

function SiteHeader(): Html {
  return (
    <header class="site-header">
      <div class="header-inner">
        <a class="wordmark" href="/">@bastianplsfix/html</a>
        <div class="header-meta">
          <span class="runtime-label">Deno-first</span>
          <span class="header-rule" aria-hidden="true"></span>
          <a href="https://jsr.io/@bastianplsfix/html">JSR</a>
          <a href="https://github.com/bastianplsfix/html">GitHub</a>
        </div>
      </div>
    </header>
  );
}

function* renderNavigation(path: string): Iterable<Html> {
  for (const section of NAVIGATION) {
    yield (
      <section class="nav-section">
        <h2>{section.label}</h2>
        <ul>{renderNavItems(section.items, path)}</ul>
      </section>
    );
  }
}

function* renderNavItems(
  items: readonly NavItem[],
  path: string,
): Iterable<Html> {
  for (const item of items) {
    const active = path === item.href;
    yield (
      <li>
        <a
          href={item.href}
          class={active ? "active" : undefined}
          aria-current={active ? "page" : undefined}
        >
          {item.label}
        </a>
      </li>
    );
  }
}

function DocsFooter(): Html {
  return (
    <footer class="docs-footer">
      <p>Typed TSX templates. HTML all the way down.</p>
      <p>
        These docs are rendered by <code>@bastianplsfix/html</code>.
      </p>
    </footer>
  );
}
