import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type Html,
  RenderError,
  renderToString,
  scriptJSON,
  unsafeHTML,
} from "@bastianplsfix/html";
import { jsx } from "../jsx-runtime.ts";

// parse5 is an exact-version, test-only WHATWG HTML parser. It validates how
// renderer output is interpreted without becoming a package/runtime dependency.
// A computed import keeps it pinned and out of package imports while remaining
// lint-compatible with the project's Deno 2.1 compatibility floor.
const parse5Specifier: string = "npm:parse5@8.0.1";
const { parse } = await import(parse5Specifier) as {
  readonly parse: (source: string) => unknown;
};

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

interface ParsedAttribute {
  readonly name: string;
  readonly value: string;
  readonly namespace?: string;
  readonly prefix?: string;
}

interface ParsedNode {
  readonly nodeName: string;
  readonly tagName?: string;
  readonly namespaceURI?: string;
  readonly attrs?: readonly ParsedAttribute[];
  readonly childNodes?: readonly ParsedNode[];
  readonly value?: string;
}

Deno.test("HTML parsing foster-parents text out of tables", async () => {
  const misplaced = "outside";
  const markup = await renderToString(
    <main id="host">
      <table id="table">
        {misplaced}
        <tr>
          <td>cell</td>
        </tr>
      </table>
    </main>,
  );

  assertStringIncludes(markup, `<table id="table">outside<tr>`);

  const document = parseBrowserDocument(markup);
  const host = elementById(document, "host");
  const table = elementById(document, "table");
  const tableIndex = children(host).indexOf(table);

  assert(tableIndex > 0);
  assertEquals(children(host)[tableIndex - 1].nodeName, "#text");
  assertEquals(children(host)[tableIndex - 1].value, misplaced);
  assertEquals(textContent(table), "cell");
  assertEquals(elementChildren(table)[0].tagName, "tbody");
});

Deno.test("optional closing tags are a parser concern, not a raw serializer rewrite", async () => {
  const source = '<ul id="list"><li>one<li>two</ul>';
  const markup = await renderToString(unsafeHTML(source));

  assertEquals(markup, source);

  const list = elementById(parseBrowserDocument(markup), "list");
  const items = elementChildren(list);
  assertEquals(items.map((item) => item.tagName), ["li", "li"]);
  assertEquals(items.map(textContent), ["one", "two"]);
});

Deno.test("textarea and title use RCDATA parser semantics", async () => {
  const title = `A < B & "title"`;
  const textarea = `\nA < B & "field"`;
  const markup = await renderToString(
    <html>
      <head>
        <title id="page-title">{title}</title>
      </head>
      <body>
        <textarea id="field">{textarea}</textarea>
      </body>
    </html>,
  );

  assertStringIncludes(
    markup,
    '<title id="page-title">A &lt; B &amp; &quot;title&quot;</title>',
  );
  assertStringIncludes(
    markup,
    '<textarea id="field">\nA &lt; B &amp; &quot;field&quot;</textarea>',
  );

  const document = parseBrowserDocument(markup);
  assertEquals(textContent(elementById(document, "page-title")), title);
  // HTML parsing deliberately strips one leading LF from textarea content.
  assertEquals(textContent(elementById(document, "field")), textarea.slice(1));
});

Deno.test("void elements remain siblings and reject renderer children", async () => {
  const markup = await renderToString(
    <div id="host">
      before<img id="picture" alt={`<&"`} />after<br id="break" />end
    </div>,
  );

  assertEquals(markup.includes("</img>"), false);
  assertEquals(markup.includes("</br>"), false);
  assertStringIncludes(markup, '<img id="picture" alt="&lt;&amp;&quot;">');

  const document = parseBrowserDocument(markup);
  const host = elementById(document, "host");
  assertEquals(
    children(host).map((node) => node.tagName ?? node.value),
    ["before", "img", "after", "br", "end"],
  );
  assertEquals(children(elementById(document, "picture")), []);
  assertEquals(
    attribute(elementById(document, "picture"), "alt")?.value,
    '<&"',
  );

  await assertRejects(
    () => renderToString(jsx("img", { children: "not allowed" })),
    RenderError,
    "Void element <img> cannot have children",
  );
});

Deno.test("trusted script and style children retain raw-text parser semantics", async () => {
  const scriptSource = `if (a < b && c > d) console.log("&amp;");`;
  const styleSource = `.card::before { content: "<&amp;>"; }`;
  const markup = await renderToString(
    <html>
      <head>
        <style id="styles">{unsafeHTML(styleSource)}</style>
      </head>
      <body>
        <script id="script">{unsafeHTML(scriptSource)}</script>
        <script id="data" type="application/json">
          {scriptJSON({ close: "</script>" })}
        </script>
      </body>
    </html>,
  );

  assertStringIncludes(markup, `<script id="script">${scriptSource}</script>`);
  assertStringIncludes(markup, `<style id="styles">${styleSource}</style>`);

  const document = parseBrowserDocument(markup);
  assertEquals(textContent(elementById(document, "script")), scriptSource);
  assertEquals(textContent(elementById(document, "styles")), styleSource);
  assertEquals(
    JSON.parse(textContent(elementById(document, "data"))),
    { close: "</script>" },
  );
});

Deno.test("SVG descendants use the SVG namespace", async () => {
  const markup = await renderToString(
    <svg id="icon" viewBox="0 0 24 24">
      <g id="group">
        <path id="path" d="M0 0h24v24z" />
      </g>
    </svg>,
  );

  assertStringIncludes(markup, '<path id="path" d="M0 0h24v24z"></path>');

  const document = parseBrowserDocument(markup);
  for (const id of ["icon", "group", "path"]) {
    assertEquals(elementById(document, id).namespaceURI, SVG_NAMESPACE);
  }
});

Deno.test("foreignObject switches to HTML and nested svg switches back", async () => {
  const markup = await renderToString(
    <svg id="outer-svg">
      <foreignObject id="foreign">
        <div id="html-child">
          <svg id="inner-svg">
            <circle id="circle" cx={1} cy={1} r={1} />
          </svg>
        </div>
      </foreignObject>
    </svg>,
  );
  const document = parseBrowserDocument(markup);

  assertEquals(elementById(document, "outer-svg").namespaceURI, SVG_NAMESPACE);
  assertEquals(elementById(document, "foreign").namespaceURI, SVG_NAMESPACE);
  assertEquals(
    elementById(document, "html-child").namespaceURI,
    HTML_NAMESPACE,
  );
  assertEquals(elementById(document, "inner-svg").namespaceURI, SVG_NAMESPACE);
  assertEquals(elementById(document, "circle").namespaceURI, SVG_NAMESPACE);
});

Deno.test("namespaced SVG attributes gain parser namespace metadata", async () => {
  // A spread keeps the serialized namespace spelling intact under Deno's
  // precompile transform; direct JSX namespace syntax is transform-dependent.
  const xlink = { "xlink:href": "#shape" } as const;
  const markup = await renderToString(
    <svg
      id="namespaced"
      xmlns:xlink={XLINK_NAMESPACE}
      xml:lang="en"
    >
      <use id="use" {...xlink} />
    </svg>,
  );

  assertStringIncludes(markup, `xmlns:xlink="${XLINK_NAMESPACE}"`);
  assertStringIncludes(markup, 'xlink:href="#shape"');

  const document = parseBrowserDocument(markup);
  const svg = elementById(document, "namespaced");
  const use = elementById(document, "use");
  assertEquals(
    namespacedAttribute(svg, "xlink", "xmlns")?.namespace,
    XMLNS_NAMESPACE,
  );
  assertEquals(
    namespacedAttribute(svg, "lang", "xml")?.namespace,
    XML_NAMESPACE,
  );
  const href = namespacedAttribute(use, "href", "xlink");
  assertEquals(href?.namespace, XLINK_NAMESPACE);
  assertEquals(href?.value, "#shape");
});

Deno.test("custom-element and attribute casing normalize only in the parser", async () => {
  const view: Html = jsx("User-Card", {
    "DATA-User-ID": "42",
    children: jsx("span", { children: "Profile" }),
  });
  const markup = await renderToString(view);

  assertEquals(
    markup,
    '<User-Card DATA-User-ID="42"><span>Profile</span></User-Card>',
  );

  const element = findElement(
    parseBrowserDocument(markup),
    (candidate) => candidate.tagName === "user-card",
  );
  assertEquals(element.namespaceURI, HTML_NAMESPACE);
  assertEquals(element.tagName, "user-card");
  assertEquals(attribute(element, "data-user-id")?.value, "42");
  assertEquals(textContent(element), "Profile");
});

Deno.test("attribute parsing decodes entities and normalizes newlines and nulls", async () => {
  const value = `line 1\r\nline 2 & "<\0`;
  const markup = await renderToString(
    jsx("DIV", {
      "DATA-Label": value,
      hidden: true,
      children: "content",
    }),
  );

  assertEquals(
    markup,
    '<DIV DATA-Label="line 1\r\nline 2 &amp; &quot;&lt;\0" hidden>content</DIV>',
  );

  const element = findElement(
    parseBrowserDocument(markup),
    (candidate) => candidate.tagName === "div",
  );
  assertEquals(element.tagName, "div");
  assertEquals(
    attribute(element, "data-label")?.value,
    'line 1\nline 2 & "<\uFFFD',
  );
  assertEquals(attribute(element, "hidden")?.value, "");
});

Deno.test("UTF-8 transport and the parser normalize invalid scalar input separately", async () => {
  const noncharacter = String.fromCodePoint(0x10FFFF);
  const value = `\0\r\n\uD800😀${noncharacter}`;
  const markup = await renderToString(<p id="unicode">{value}</p>);

  // The string renderer escapes HTML delimiters but otherwise preserves input
  // code units. Web UTF-8 encoding replaces the lone surrogate, while HTML
  // parsing drops a text-state NULL and normalizes CRLF.
  assertStringIncludes(markup, value);
  const parsed = textContent(
    elementById(parseBrowserDocument(markup), "unicode"),
  );
  assertEquals(parsed, `\n\uFFFD😀${noncharacter}`);
});

function parseBrowserDocument(markup: string): ParsedNode {
  const bytes = new TextEncoder().encode(markup);
  const browserInput = new TextDecoder().decode(bytes);
  return parse(browserInput) as unknown as ParsedNode;
}

function children(node: ParsedNode): readonly ParsedNode[] {
  return node.childNodes ?? [];
}

function elementChildren(node: ParsedNode): readonly ParsedNode[] {
  return children(node).filter((child) => child.tagName !== undefined);
}

function elementById(root: ParsedNode, id: string): ParsedNode {
  return findElement(root, (element) => attribute(element, "id")?.value === id);
}

function findElement(
  root: ParsedNode,
  predicate: (element: ParsedNode) => boolean,
): ParsedNode {
  if (root.tagName !== undefined && predicate(root)) {
    return root;
  }

  for (const child of children(root)) {
    const match = findElementOrUndefined(child, predicate);
    if (match) {
      return match;
    }
  }

  throw new Error("Expected parsed element was not found.");
}

function findElementOrUndefined(
  root: ParsedNode,
  predicate: (element: ParsedNode) => boolean,
): ParsedNode | undefined {
  if (root.tagName !== undefined && predicate(root)) {
    return root;
  }

  for (const child of children(root)) {
    const match = findElementOrUndefined(child, predicate);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function attribute(
  element: ParsedNode,
  name: string,
): ParsedAttribute | undefined {
  return element.attrs?.find((candidate) => candidate.name === name);
}

function namespacedAttribute(
  element: ParsedNode,
  name: string,
  prefix: string,
): ParsedAttribute | undefined {
  return element.attrs?.find((candidate) =>
    candidate.name === name && candidate.prefix === prefix
  );
}

function textContent(node: ParsedNode): string {
  if (node.nodeName === "#text") {
    return node.value ?? "";
  }

  return children(node).map(textContent).join("");
}
