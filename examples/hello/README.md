# Hello example

This standalone project imports `@bastianplsfix/html` from JSR, so it checks the
same package and JSX runtime that an application would use.

Run the checks:

```sh
deno task check
```

Start the server and open <http://localhost:8000>:

```sh
deno task start
```

Try an interpolated value with
<http://localhost:8000/?name=%3Cstrong%3EDeno%3C%2Fstrong%3E>. The markup is
rendered as escaped text.
