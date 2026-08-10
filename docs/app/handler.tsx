import type { Renderable } from "@bastianplsfix/html";
import { html } from "@bastianplsfix/html/response";
import { DocsLayout } from "../components/mod.ts";
import { NotFoundPage } from "../pages/mod.ts";
import { serveAsset } from "./assets.ts";
import { findRoute } from "./routes.ts";
import packageConfig from "../../deno.json" with { type: "json" };

const PAGE_HEADERS = {
  "cache-control": "no-cache",
  "content-security-policy":
    "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-html-version": packageConfig.version,
} as const;

/** Route and render one documentation request. */
export async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  const url = new URL(request.url);
  const head = request.method === "HEAD";

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/u, "");
    return Response.redirect(url, 308);
  }

  const asset = await serveAsset(url.pathname, head);
  if (asset) {
    return asset;
  }

  const route = findRoute(url.pathname);
  if (!route) {
    return await renderPage(
      <DocsLayout
        title="Page not found"
        description="The requested documentation page does not exist."
        path={url.pathname}
      >
        <NotFoundPage path={url.pathname} />
      </DocsLayout>,
      404,
      head,
    );
  }

  const Page = route.component;
  return await renderPage(
    <DocsLayout
      title={route.title}
      description={route.description}
      path={url.pathname}
    >
      <Page />
    </DocsLayout>,
    200,
    head,
  );
}

async function renderPage(
  view: Renderable,
  status: number,
  head: boolean,
): Promise<Response> {
  const response = await html(view, { status, headers: PAGE_HEADERS });

  return head
    ? new Response(null, {
      status: response.status,
      headers: response.headers,
    })
    : response;
}
