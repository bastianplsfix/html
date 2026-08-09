/**
 * Optional Web Standard `Response` integration.
 *
 * @module
 */

import { type Renderable, renderToString } from "./mod.ts";

/** Render a view into an HTML response, preserving caller-supplied headers. */
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
