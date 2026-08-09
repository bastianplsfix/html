/**
 * Optional Web Standard `Response` integration.
 *
 * @module
 */

import { type Renderable, renderToString } from "./mod.ts";

/** The values accepted by the response renderer. */
export type { Renderable } from "./mod.ts";

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
  init: ResponseInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "text/html; charset=utf-8");
  }

  const body = await renderToString(view);

  return new Response(body, {
    ...init,
    headers,
  });
}
