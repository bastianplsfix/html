import { doctype, type Renderable } from "../mod.ts";

/** A named rendering workload shared by microbenchmarks and profiling. */
export interface RenderFixture {
  readonly name: string;
  readonly view: () => Renderable;
}

const STATIC_DOCUMENT = (
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
  Array.from({ length: 1_000 }, (_, index) => ({
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

function DeepTree({ depth }: { readonly depth: number }): Renderable {
  if (depth === 0) {
    return <span>leaf</span>;
  }
  return (
    <section data-depth={depth}>
      <DeepTree depth={depth - 1} />
    </section>
  );
}

function* syncItems(count: number): Iterable<Renderable> {
  for (let index = 0; index < count; index++) {
    yield <li data-index={index}>Item {index}</li>;
  }
}

async function* asyncItems(count: number): AsyncIterable<Renderable> {
  for (let index = 0; index < count; index++) {
    await Promise.resolve();
    yield <li data-index={index}>Item {index}</li>;
  }
}

const MANY_ATTRIBUTES: Readonly<Record<string, string | number | boolean>> =
  Object.freeze(Object.fromEntries(
    Array.from(
      { length: 250 },
      (_, index) => [`data-field-${index}`, `value-${index}-<&\"`],
    ),
  ));

/** Representative workloads used by the detailed profiler. */
export const PROFILE_FIXTURES: readonly RenderFixture[] = Object.freeze([
  { name: "static template", view: () => STATIC_DOCUMENT },
  { name: "escaped dynamic values", view: () => DYNAMIC_VIEW },
  {
    name: "large list (1,000 rows)",
    view: () => <ProductList products={PRODUCTS} />,
  },
  { name: "deep component tree (250)", view: () => <DeepTree depth={250} /> },
  { name: "sync iterable (1,000)", view: () => <ol>{syncItems(1_000)}</ol> },
  { name: "async iterable (250)", view: () => <ol>{asyncItems(250)}</ol> },
  { name: "many attributes (250)", view: () => <div {...MANY_ATTRIBUTES} /> },
]);

/** Smaller component fixture for stable `Deno.bench` iteration counts. */
export function componentListView(count = 50): Renderable {
  return <ProductList products={PRODUCTS.slice(0, count)} />;
}

/** Smaller asynchronous-component fixture for microbenchmarks. */
export function asyncComponentListView(count = 12): Renderable {
  async function AsyncPrice({ product }: { readonly product: Product }) {
    await Promise.resolve();
    return <span data-product-id={product.id}>${product.price}</span>;
  }

  return (
    <section>
      <h2>Latest prices</h2>
      {PRODUCTS.slice(0, count).map((product) => (
        <AsyncPrice product={product} />
      ))}
    </section>
  );
}

/** Smaller asynchronous iterable fixture for microbenchmarks. */
export function asyncIterableView(count = 20): Renderable {
  return <ol>{asyncItems(count)}</ol>;
}

/** Escaped dynamic fixture used by the microbenchmark suite. */
export function dynamicView(): Renderable {
  return DYNAMIC_VIEW;
}

/** Static fixture used by the microbenchmark suite. */
export function staticView(): Renderable {
  return STATIC_DOCUMENT;
}
