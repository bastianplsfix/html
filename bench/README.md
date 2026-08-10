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

For workload-level measurements, including time to first byte, total stream
duration, observed heap growth, chunk count, average chunk size, a throttled
consumer, and cancellation cleanup, run:

```sh
deno task bench:profile
```

The profiler reports the median of seven timing iterations. Use `--iterations=N`
for a quicker or longer local run:

```sh
deno run --v8-flags=--expose-gc bench/profile.tsx --iterations=3
```

The fixtures cover a precompiled static document, escaped text and attributes, a
50-row component tree, asynchronous components, stream consumption, and an async
iterable. Instruction values are created once outside the timed functions so the
results primarily measure rendering. Components still create their child
instructions when the renderer invokes them, as they do in an application.

The detailed profiler adds a 1,000-row list, a 250-level component tree, a
1,000-value synchronous iterable, a 250-value asynchronous iterable, and an
element with 250 attributes. Its heap figures are sampled in a separate pass
from timing because sampling itself adds scheduling overhead. They are observed
heap-growth indicators, not a process RSS ceiling. Exposing V8's garbage
collector makes the pre-measurement baseline more repeatable; the profiler still
runs when that flag is unavailable.

Compare results only on the same machine and Deno version, with similar system
load. Lower time per iteration and higher iterations per second are better.
Streaming measurements include UTF-8 encoding and `ReadableStream` consumption;
they do not measure network throughput. The detailed profile's first-byte value
starts immediately before stream construction and ends at the first successful
reader result. Async fixtures use resolved promises deliberately, so they
measure renderer scheduling overhead, not database or network latency. Chunk
boundaries are an implementation detail; their metrics exist to reveal
regressions such as excessively small chunks under slow consumers.
