/**
 * Optional Web Standard `Response` integration.
 *
 * @module
 */

import {
  type Renderable,
  renderToStream,
  renderToString,
  type RenderWarning,
} from "./mod.ts";

/** Public value and diagnostic types referenced by this entrypoint. */
export type { Renderable, RenderWarning } from "./mod.ts";

/** Options shared by buffered and streaming HTML response helpers. */
export interface HtmlResponseInit extends ResponseInit {
  /** Stops rendering when the associated request is aborted. */
  readonly signal?: AbortSignal;
  /** Receives non-fatal diagnostics discovered while rendering. */
  readonly onWarning?: (warning: RenderWarning) => void;
}

/**
 * Render a view into a buffered HTML response.
 *
 * Caller-supplied headers and response options are preserved. A
 * `content-type` of `text/html; charset=utf-8` is added only when the caller did
 * not provide one.
 *
 * @param view The renderable value used as the response body.
 * @param init Status, headers, and other standard response options.
 * @returns A response whose body has been fully rendered.
 */
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

/**
 * Render a view into a streaming HTML response.
 *
 * The response is created immediately. Rendering failures after bytes are read
 * surface through the response body stream and cannot change its status.
 */
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
