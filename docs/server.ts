import { handler } from "./app/handler.tsx";

/** Production entrypoint for Deno Deploy and `deno run`. */
Deno.serve(handler);
