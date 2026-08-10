type PrimaryModule = {
  readonly renderToStream: (
    view: unknown,
  ) => ReadableStream<Uint8Array>;
  readonly renderToString: (view: unknown) => Promise<string>;
};

type RuntimeModule = {
  readonly jsx: (
    type: string,
    props: Readonly<Record<string, unknown>>,
  ) => unknown;
};

type ResponseModule = {
  readonly html: (view: unknown) => Promise<Response>;
};

const config = JSON.parse(await Deno.readTextFile("deno.json")) as {
  readonly name: string;
  readonly version: string;
};
const packageSpecifier = `jsr:${config.name}@${config.version}`;

const primary = await import(packageSpecifier) as PrimaryModule;
const runtime = await import(
  `${packageSpecifier}/jsx-runtime`
) as RuntimeModule;
const responseAdapter = await import(
  `${packageSpecifier}/response`
) as ResponseModule;

const view = runtime.jsx("p", { children: "<published>" });
const expected = "<p>&lt;published&gt;</p>";
const buffered = await primary.renderToString(view);
if (buffered !== expected) {
  throw new Error(`Published buffered output was ${JSON.stringify(buffered)}.`);
}

const streamed = await new Response(primary.renderToStream(view)).text();
if (streamed !== expected) {
  throw new Error(`Published stream output was ${JSON.stringify(streamed)}.`);
}

const response = await responseAdapter.html(view);
if (
  await response.text() !== expected ||
  response.headers.get("content-type") !== "text/html; charset=utf-8"
) {
  throw new Error("Published response adapter did not preserve its contract.");
}

console.log(
  `Published package smoke passed for ${config.name}@${config.version}.`,
);
