/**
 * Optional Web Standard `Response` integration.
 *
 * @module
 */

import {
  type Renderable,
  type RenderWarning,
  renderToStream,
  renderToString,
} from "./mod.ts";

/** Options for buffered and streaming HTML responses. */
export interface HtmlResponseInit extends ResponseInit {
  /** Stops rendering when the associated request is aborted. */
  readonly signal?: AbortSignal;
  /** Receives non-fatal diagnostics discovered while rendering. */
  readonly onWarning?: (warning: RenderWarning) => void;
}

/** Render a view into an HTML response, preserving caller-supplied headers. */
export async function html(
  view: Renderable,
  init: HtmlResponseInit = {},
): Promise<Response> {
  const { onWarning, signal, ...responseInit } = init;
  const headers = htmlHeaders(responseInit.headers);

  const body = await renderToString(view, { onWarning, signal });

  return new Response(body, {
    ...responseInit,
    headers,
  });
}

/** Stream a view into an HTML response, preserving caller-supplied headers. */
export function streamHtml(
  view: Renderable,
  init: HtmlResponseInit = {},
): Response {
  const { onWarning, signal, ...responseInit } = init;
  const headers = htmlHeaders(responseInit.headers);
  const body = renderToStream(view, { onWarning, signal });

  return new Response(body, {
    ...responseInit,
    headers,
  });
}

function htmlHeaders(init: HeadersInit | undefined): Headers {
  const headers = new Headers(init);

  if (!headers.has("content-type")) {
    headers.set("content-type", "text/html; charset=utf-8");
  }

  return headers;
}
