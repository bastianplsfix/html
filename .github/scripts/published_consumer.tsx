import {
  type Children,
  type CustomElementProps,
  type Html,
  type IntrinsicElementProps,
  type Renderable,
  renderToStream,
  renderToString,
  scriptJSON,
} from "@bastianplsfix/html";
import { jsx } from "@bastianplsfix/html/jsx-runtime";
import { jsxDEV } from "@bastianplsfix/html/jsx-dev-runtime";
import {
  html,
  type HtmlResponseInit,
  streamHtml,
} from "@bastianplsfix/html/response";

declare module "@bastianplsfix/html/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "status-pill": CustomElementProps<{
        variant?: "neutral" | "success";
      }>;
    }
  }
}

function Shell({ children }: { readonly children?: Children }): Html {
  return <main data-release="published">{children}</main>;
}

const buttonProps: IntrinsicElementProps<"button"> = { type: "button" };
const view: Renderable = (
  <Shell>
    <span>{"<published>"}</span>
    <button {...buttonProps}>Ready</button>
    <status-pill variant="success">Healthy</status-pill>
  </Shell>
);
const expected =
  '<main data-release="published"><span>&lt;published&gt;</span><button type="button">Ready</button><status-pill variant="success">Healthy</status-pill></main>';
if (await renderToString(view) !== expected) {
  throw new Error("Published precompiled TSX output did not match.");
}
if (await new Response(renderToStream(view)).text() !== expected) {
  throw new Error("Published precompiled TSX stream did not match.");
}

const runtimeView = jsx("p", { children: "<runtime>" });
if (await renderToString(runtimeView) !== "<p>&lt;runtime&gt;</p>") {
  throw new Error("Published JSX runtime entrypoint did not match.");
}
const developmentView = jsxDEV("p", { children: "<development>" });
if (await renderToString(developmentView) !== "<p>&lt;development&gt;</p>") {
  throw new Error("Published development runtime entrypoint did not match.");
}

const responseInit: HtmlResponseInit = { status: 201 };
const bufferedResponse = await html(view, responseInit);
if (
  bufferedResponse.status !== 201 || await bufferedResponse.text() !== expected
) {
  throw new Error("Published buffered response adapter did not match.");
}
const streamedResponse = streamHtml(view, responseInit);
if (
  streamedResponse.status !== 201 || await streamedResponse.text() !== expected
) {
  throw new Error("Published streaming response adapter did not match.");
}

const rawText = await renderToString(
  <script type="application/json">
    {scriptJSON({ close: "</script>" })}
  </script>,
);
const expectedRawText =
  '<script type="application/json">{"close":"\\u003C/script\\u003E"}</script>';
if (rawText !== expectedRawText) {
  throw new Error(
    `Published raw-text output was ${JSON.stringify(rawText)}.`,
  );
}

const typedSvg: Html = (
  <svg viewBox="0 0 1 1" aria-label="pixel">
    <path stroke-linecap="round" d="M0 0L1 1" />
  </svg>
);
if (!(await renderToString(typedSvg)).startsWith("<svg")) {
  throw new Error("Published generated JSX types/runtime did not match.");
}

console.log("published-tsx-consumer-ok");
