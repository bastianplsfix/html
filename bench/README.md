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

## Reference optimization run

The synchronous fast path and bounded stream coalescing were accepted after a
same-machine before/after profile on 2026-08-10 using Deno 2.9.5 on Apple arm64.
The table reports medians from three iterations; it is evidence for that change,
not a portable performance promise.

| Fixture           | Buffered before → after | Stream before → after | Chunks before → after |
| ----------------- | ----------------------: | --------------------: | --------------------: |
| 1,000-row list    |       15.947 → 2.481 ms |     19.384 → 6.940 ms |           10,752 → 79 |
| 250-level tree    |       49.150 → 0.375 ms |    52.186 → 27.602 ms |           1,001 → 495 |
| 1,000 sync values |        4.095 → 1.668 ms |      6.564 → 2.173 ms |            5,002 → 32 |
| 250 async values  |        1.279 → 0.584 ms |      2.578 → 1.484 ms |           1,252 → 251 |

The throttled-consumer fixture fell from 1045.727 ms to 16.360 ms. The cost was
a small first-byte delay from bounded coalescing: 0.083 ms for the list, 0.064
ms for the synchronous iterable, and 0.026 ms for the static template. Exact
values will vary by machine; rerun the profiler instead of treating this table
as a regression threshold.
