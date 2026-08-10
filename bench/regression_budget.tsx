import { renderToStream, renderToString } from "../mod.ts";
import { componentListView } from "./fixtures.tsx";

const BUFFERED_BUDGET_MS = 2_000;
const FIRST_BYTE_BUDGET_MS = 500;
const STREAM_TOTAL_BUDGET_MS = 3_000;
const CANCELLATION_BUDGET_MS = 500;

Deno.test("representative rendering stays within broad CI budgets", async () => {
  const view = componentListView(500);
  await renderToString(view);

  const bufferedMs = await medianDuration(async () => {
    await renderToString(view);
  });

  const streamStarted = performance.now();
  const reader = renderToStream(view).getReader();
  const first = await reader.read();
  const firstByteMs = performance.now() - streamStarted;
  if (first.done) {
    throw new Error("The representative stream ended without emitting bytes.");
  }
  while (!(await reader.read()).done) {
    // Consume the complete stream to measure its broad end-to-end budget.
  }
  const streamTotalMs = performance.now() - streamStarted;

  const cancellationStarted = performance.now();
  const cancellationReader = renderToStream(componentListView(500)).getReader();
  await cancellationReader.read();
  await cancellationReader.cancel("benchmark budget complete");
  const cancellationMs = performance.now() - cancellationStarted;

  assertBudget("buffered duration", bufferedMs, BUFFERED_BUDGET_MS);
  assertBudget("stream time to first byte", firstByteMs, FIRST_BYTE_BUDGET_MS);
  assertBudget("stream total duration", streamTotalMs, STREAM_TOTAL_BUDGET_MS);
  assertBudget("stream cancellation", cancellationMs, CANCELLATION_BUDGET_MS);
});

async function medianDuration(operation: () => Promise<void>): Promise<number> {
  const samples: number[] = [];
  for (let index = 0; index < 5; index++) {
    const started = performance.now();
    await operation();
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)];
}

function assertBudget(name: string, actual: number, budget: number): void {
  if (actual > budget) {
    throw new Error(
      `${name} took ${
        actual.toFixed(1)
      } ms; the broad CI budget is ${budget} ms. Run \`deno task bench:profile\` before changing the budget.`,
    );
  }
}
