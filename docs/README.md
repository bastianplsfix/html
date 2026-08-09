# Documentation application

The documentation site is a small Deno application rendered with this package.
It intentionally has no client-side JavaScript.

```text
docs/
├── app/          HTTP handler, routes, and static asset responses
├── components/   Shared document and content components
├── content/      Source-code examples displayed by pages
├── pages/        One component per documentation route
├── static/       Stylesheets and other public assets
├── test/         Request-level documentation tests
└── main.ts       `deno serve` entrypoint
```

Run the development server from the repository root:

```sh
deno task docs
```

Run all formatting, linting, type, and request-level checks with:

```sh
deno task check
```
