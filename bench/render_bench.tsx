import {
  doctype,
  type Renderable,
  renderToStream,
  renderToString,
} from "../mod.ts";

const STATIC_VIEW = (
  <>
    {doctype()}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <title>Benchmark</title>
      </head>
      <body>
        <main>
          <h1>Server-only TSX</h1>
          <p>Typed templates with no virtual DOM or client runtime.</p>
          <a href="/docs">Read the documentation</a>
        </main>
      </body>
    </html>
  </>
);

const QUERY = `<script>alert("benchmark")</script> & more`;
const DYNAMIC_VIEW = (
  <article class="search-result" data-result-count={42}>
    <h1>Results for “{QUERY}”</h1>
    <p>{42} matching entries</p>
    <a href={`/search?q=${encodeURIComponent(QUERY)}`}>Permanent link</a>
  </article>
);

type Product = {
  readonly id: number;
  readonly name: string;
  readonly price: string;
  readonly available: boolean;
};

const PRODUCTS: readonly Product[] = Object.freeze(
  Array.from({ length: 50 }, (_, index) => ({
    id: index + 1,
    name: `Product ${index + 1}`,
    price: (12.5 + index * 1.25).toFixed(2),
    available: index % 4 !== 0,
  })),
);

function ProductRow({ product }: { readonly product: Product }) {
  return (
    <li data-product-id={product.id}>
      <a href={`/products/${product.id}`}>{product.name}</a>
      <span class="price">${product.price}</span>
      {product.available ? <span class="stock">In stock</span> : null}
    </li>
  );
}

function ProductList({ products }: { readonly products: readonly Product[] }) {
  return (
    <section aria-labelledby="products-heading">
      <h2 id="products-heading">Products</h2>
      <ul>
        {products.map((product) => <ProductRow product={product} />)}
      </ul>
    </section>
  );
}

const COMPONENT_VIEW = <ProductList products={PRODUCTS} />;

async function AsyncPrice({ product }: { readonly product: Product }) {
  await Promise.resolve();
  return <span data-product-id={product.id}>${product.price}</span>;
}

function AsyncPriceList(
  { products }: { readonly products: readonly Product[] },
) {
  return (
    <section>
      <h2>Latest prices</h2>
      {products.map((product) => <AsyncPrice product={product} />)}
    </section>
  );
}

const ASYNC_COMPONENT_VIEW = (
  <AsyncPriceList
    products={PRODUCTS.slice(0, 12)}
  />
);

async function* updates(): AsyncIterable<Renderable> {
  for (let index = 1; index <= 20; index++) {
    await Promise.resolve();
    yield <li data-sequence={index}>Update {index}</li>;
  }
}

function AsyncFeed() {
  return <ol>{updates()}</ol>;
}

const ASYNC_ITERABLE_VIEW = <AsyncFeed />;

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
