import { renderToStream, renderToString } from "../mod.ts";
import { PROFILE_FIXTURES, type RenderFixture } from "./fixtures.tsx";

interface StreamMeasurement {
  readonly firstByteMs: number;
  readonly totalMs: number;
  readonly chunks: number;
  readonly bytes: number;
}

interface ProfileResult extends StreamMeasurement {
  readonly fixture: string;
  readonly bufferedMs: number;
  readonly bufferedPeakHeapBytes: number;
  readonly streamPeakHeapBytes: number;
}

const iterations = parseIterations(Deno.args);

const results: ProfileResult[] = [];
for (const fixture of PROFILE_FIXTURES) {
  await warmUp(fixture);

  const bufferedSamples: number[] = [];
  const streamSamples: StreamMeasurement[] = [];
  for (let index = 0; index < iterations; index++) {
    const bufferedStart = performance.now();
    await renderToString(fixture.view());
    bufferedSamples.push(performance.now() - bufferedStart);
    streamSamples.push(await measureStream(fixture));
  }

  const bufferedMemory = await measurePeakHeap(() =>
    renderToString(fixture.view())
  );
  const streamMemory = await measurePeakHeap(() =>
    consume(renderToStream(fixture.view()))
  );
  const representativeStream = medianBy(
    streamSamples,
    (sample) => sample.totalMs,
  );

  results.push({
    fixture: fixture.name,
    bufferedMs: median(bufferedSamples),
    bufferedPeakHeapBytes: bufferedMemory,
    streamPeakHeapBytes: streamMemory,
    ...representativeStream,
  });
}

const slowConsumerMs = await measureSlowConsumer();
const cancellationMs = await measureCancellation();

console.table(results.map((result) => ({
  fixture: result.fixture,
  "buffered ms": decimal(result.bufferedMs),
  "first byte ms": decimal(result.firstByteMs),
  "stream total ms": decimal(result.totalMs),
  chunks: result.chunks,
  "average bytes/chunk": result.chunks === 0
    ? 0
    : Math.round(result.bytes / result.chunks),
  "buffered peak heap": bytes(result.bufferedPeakHeapBytes),
  "stream peak heap": bytes(result.streamPeakHeapBytes),
})));
console.log(
  `Slow consumer (1 ms pause every 25 chunks): ${decimal(slowConsumerMs)} ms`,
);
console.log(
  `Cancellation after 10 chunks, including cleanup: ${
    decimal(cancellationMs)
  } ms`,
);
console.log(
  `Deno ${Deno.version.deno}; ${iterations} timing iterations (median shown)`,
);

async function warmUp(fixture: RenderFixture): Promise<void> {
  await renderToString(fixture.view());
  await consume(renderToStream(fixture.view()));
}

async function measureStream(
  fixture: RenderFixture,
): Promise<StreamMeasurement> {
  const started = performance.now();
  const reader = renderToStream(fixture.view()).getReader();
  const first = await reader.read();
  const firstByteMs = performance.now() - started;
  let chunks = first.done ? 0 : 1;
  let byteLength = first.done ? 0 : first.value.byteLength;

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    chunks++;
    byteLength += result.value.byteLength;
  }

  return {
    firstByteMs,
    totalMs: performance.now() - started,
    chunks,
    bytes: byteLength,
  };
}

async function consume(stream: ReadableStream<Uint8Array>): Promise<number> {
  let byteLength = 0;
  for await (const chunk of stream) {
    byteLength += chunk.byteLength;
  }
  return byteLength;
}

async function measurePeakHeap<T>(
  operation: () => Promise<T>,
): Promise<number> {
  maybeCollectGarbage();
  const baseline = Deno.memoryUsage().heapUsed;
  let peak = baseline;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      peak = Math.max(peak, Deno.memoryUsage().heapUsed);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
  })();

  try {
    await operation();
    peak = Math.max(peak, Deno.memoryUsage().heapUsed);
  } finally {
    sampling = false;
    await sampler;
  }
  return peak - baseline;
}

async function measureSlowConsumer(): Promise<number> {
  const fixture = PROFILE_FIXTURES.find((item) =>
    item.name.startsWith("large")
  );
  if (!fixture) {
    throw new Error("The large-list profiling fixture is missing.");
  }

  const started = performance.now();
  let chunks = 0;
  for await (const _chunk of renderToStream(fixture.view())) {
    chunks++;
    if (chunks % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  return performance.now() - started;
}

async function measureCancellation(): Promise<number> {
  let cleanedUp = false;
  async function* values() {
    try {
      for (let index = 0; index < 1_000; index++) {
        yield `chunk-${index}`;
      }
    } finally {
      await Promise.resolve();
      cleanedUp = true;
    }
  }

  const reader = renderToStream(values()).getReader();
  for (let index = 0; index < 10; index++) {
    const result = await reader.read();
    if (result.done) {
      throw new Error("Cancellation fixture ended before the tenth chunk.");
    }
  }

  const started = performance.now();
  await reader.cancel("profile complete");
  if (!cleanedUp) {
    throw new Error("Stream cancellation returned before iterator cleanup.");
  }
  return performance.now() - started;
}

function maybeCollectGarbage(): void {
  const collect = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  collect?.();
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function medianBy<T>(values: readonly T[], select: (value: T) => number): T {
  return [...values].sort((left, right) => select(left) - select(right))[
    Math.floor(values.length / 2)
  ];
}

function parseIterations(args: readonly string[]): number {
  const argument = args.find((value) => value.startsWith("--iterations="));
  const value = argument ? Number(argument.slice("--iterations=".length)) : 7;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new TypeError("--iterations must be an integer from 1 through 100.");
  }
  return value;
}

function decimal(value: number): string {
  return value.toFixed(3);
}

function bytes(value: number): string {
  if (value < 1_024) {
    return `${value} B`;
  }
  if (value < 1_048_576) {
    return `${(value / 1_024).toFixed(1)} KiB`;
  }
  return `${(value / 1_048_576).toFixed(1)} MiB`;
}
