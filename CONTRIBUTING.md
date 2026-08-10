# Contributing

Thanks for helping improve `@bastianplsfix/html`.

## Before opening a pull request

Install the latest stable Deno 2 release, fork the repository, and create a
focused branch. Keep the renderer server-only: routing, hydration, hooks, and a
client runtime are deliberately outside the project.

The compatibility floor is Deno 2.1. CI checks that line as well as the latest
stable release, but contributors should use a currently maintained stable or LTS
release locally.

Run the complete project checks from the repository root:

```sh
deno task check
```

Generated standards data must remain deterministic and offline during normal
checks. Changes to generated JSX types should update their pinned source
snapshots and pass the drift check included by `deno task check`.

Also verify the standalone JSR consumer when changing package exports, JSX
behavior, or public types:

```sh
cd examples/hello
deno task check
```

Add tests for behavior changes. Security-sensitive changes should cover text,
attribute, and raw-text contexts as applicable. Update documentation when a
public API or rendering guarantee changes.

## Pull requests

Explain the problem, the chosen behavior, and any compatibility or security
tradeoffs. Keep commits small and use imperative commit subjects. CI must pass
before merging.

Only maintainers publish releases. Package versions follow semantic versioning
and are published to JSR from matching `vX.Y.Z` Git tags. See
[RELEASING.md](./RELEASING.md) for the verified release sequence.
