const STYLESHEET_URL = new URL("../static/styles.css", import.meta.url);

const FAVICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  '<rect x="1" y="1" width="62" height="62" rx="8" fill="white" stroke="#222" stroke-width="2"/>',
  '<path d="m25 18-13 14 13 14M39 18l13 14-13 14" fill="none" stroke="#222" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="m36 13-8 38" stroke="#222" stroke-width="4" stroke-linecap="round"/>',
  "</svg>",
].join("");

/** Serve a known documentation asset, or return `undefined` for page routing. */
export async function serveAsset(
  path: string,
  head: boolean,
): Promise<Response | undefined> {
  if (path === "/styles.css") {
    const css = await Deno.readTextFile(STYLESHEET_URL);
    return assetResponse(css, "text/css; charset=utf-8", head);
  }

  if (path === "/favicon.svg") {
    return assetResponse(FAVICON, "image/svg+xml; charset=utf-8", head);
  }

  return undefined;
}

function assetResponse(
  body: string,
  contentType: string,
  head: boolean,
): Response {
  return new Response(head ? null : body, {
    headers: {
      "cache-control": "no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
}
