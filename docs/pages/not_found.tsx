import type { Html } from "@bastianplsfix/html";

interface NotFoundPageProps {
  readonly path: string;
}

/** Documentation 404 page. */
export function NotFoundPage({ path }: NotFoundPageProps): Html {
  return (
    <section class="not-found">
      <h1>404: This page did not render.</h1>
      <p>
        There is no documentation route for <code>{path}</code>.
      </p>
      <a class="button button-primary" href="/">Return to the overview</a>
    </section>
  );
}
