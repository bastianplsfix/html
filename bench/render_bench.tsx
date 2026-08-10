import { renderToStream, renderToString } from "../mod.ts";
import {
  asyncComponentListView,
  asyncIterableView,
  componentListView,
  dynamicView,
  staticView,
} from "./fixtures.tsx";

const STATIC_VIEW = staticView();
const DYNAMIC_VIEW = dynamicView();
const COMPONENT_VIEW = componentListView();
const ASYNC_COMPONENT_VIEW = asyncComponentListView();
const ASYNC_ITERABLE_VIEW = asyncIterableView();

async function consume(stream: ReadableStream<Uint8Array>): Promise<number> {
  let byteLength = 0;

  for await (const chunk of stream) {
    byteLength += chunk.byteLength;
  }

  return byteLength;
}

await verifyFixtures();

Deno.bench("buffered: static document", async () => {
  await renderToString(STATIC_VIEW);
});

Deno.bench("buffered: escaped dynamic values", async () => {
  await renderToString(DYNAMIC_VIEW);
});

Deno.bench("buffered: component list (50 rows)", async () => {
  await renderToString(COMPONENT_VIEW);
});

Deno.bench("buffered: async components (12 awaits)", async () => {
  await renderToString(ASYNC_COMPONENT_VIEW);
});

Deno.bench("stream: consume component list (50 rows)", async () => {
  await consume(renderToStream(COMPONENT_VIEW));
});

Deno.bench("stream: consume async iterable (20 yields)", async () => {
  await consume(renderToStream(ASYNC_ITERABLE_VIEW));
});

async function verifyFixtures(): Promise<void> {
  const dynamic = await renderToString(DYNAMIC_VIEW);
  if (
    dynamic.includes("<script>") ||
    !dynamic.includes("&lt;script&gt;")
  ) {
    throw new Error("The dynamic benchmark fixture did not escape its input.");
  }

  const buffered = await renderToString(COMPONENT_VIEW);
  const streamedBytes = await consume(renderToStream(COMPONENT_VIEW));
  const expectedBytes = new TextEncoder().encode(buffered).byteLength;
  if (streamedBytes !== expectedBytes) {
    throw new Error("Buffered and streamed benchmark fixtures do not match.");
  }
}
