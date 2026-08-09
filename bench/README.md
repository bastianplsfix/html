# Rendering benchmarks

This suite measures `@bastianplsfix/html` against itself across representative
rendering paths. It is intended to catch regressions and guide profiling, not to
claim performance advantages over unrelated renderers.

From the repository root, run:

```sh
deno bench bench/
```

Run one category while investigating a change:

```sh
deno bench --filter='buffered:' bench/
deno bench --filter='stream:' bench/
```

The fixtures cover a precompiled static document, escaped text and attributes, a
50-row component tree, asynchronous components, stream consumption, and an async
iterable. Instruction values are created once outside the timed functions so the
results primarily measure rendering. Components still create their child
instructions when the renderer invokes them, as they do in an application.

Compare results only on the same machine and Deno version, with similar system
load. Lower time per iteration and higher iterations per second are better.
Streaming measurements include UTF-8 encoding and `ReadableStream` consumption;
they do not measure network throughput or time to first byte. Async fixtures use
resolved promises deliberately, so they measure renderer scheduling overhead,
not database or network latency.
