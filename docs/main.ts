import { handler } from "./app/handler.tsx";

/** Documentation server entrypoint for `deno serve`. */
export default {
  fetch: handler,
} satisfies Deno.ServeDefaultExport;
