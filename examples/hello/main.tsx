import { doctype } from "@bastianplsfix/html";
import { html } from "@bastianplsfix/html/response";

type PageProps = {
  readonly name: string;
};

/** A small page rendered by the published JSR package. */
export function Page({ name }: PageProps) {
  return (
    <>
      {doctype()}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>Hello, {name}</title>
        </head>
        <body>
          <main>
            <h1>Hello, {name}!</h1>
            <p>This page was rendered from server-only TSX.</p>
          </main>
        </body>
      </html>
    </>
  );
}

/** Handle requests without depending on an application framework. */
export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname !== "/") {
    return new Response("Not found", { status: 404 });
  }

  return await html(<Page name={url.searchParams.get("name") ?? "Deno"} />);
}

export default { fetch: handler } satisfies Deno.ServeDefaultExport;
