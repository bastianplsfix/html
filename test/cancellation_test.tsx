import { assertEquals, assertRejects } from "@std/assert";
import {
  type Renderable,
  RenderError,
  renderToStream,
  renderToString,
} from "@bastianplsfix/html";

function renderable(value: unknown): Renderable {
  return value as Renderable;
}

function asyncIterable(iterator: object): Renderable {
  return renderable({
    [Symbol.asyncIterator]() {
      return iterator;
    },
  });
}

function validReturn() {
  return { done: true, value: undefined } as const;
}

async function assertPending(promise: Promise<unknown>): Promise<void> {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await Promise.resolve();
  assertEquals(settled, false);
}

Deno.test("buffered component promises abort with the exact signal reason", async () => {
  const controller = new AbortController();
  const reason = new DOMException("request ended", "AbortError");
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<Renderable>();

  function PendingComponent() {
    started.resolve();
    return pending.promise;
  }

  const rendering = renderToString(<PendingComponent />, {
    signal: controller.signal,
  });
  await started.promise;
  controller.abort(reason);

  assertEquals(await rendering.catch((error) => error), reason);
  pending.resolve("late value");
});

Deno.test("buffered pending next aborts promptly while hanging cleanup continues", async () => {
  const controller = new AbortController();
  const reason = new DOMException("request ended", "AbortError");
  const nextStarted = Promise.withResolvers<void>();
  const next = Promise.withResolvers<IteratorResult<Renderable>>();
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();
  let returnCalls = 0;

  const source = asyncIterable({
    next() {
      nextStarted.resolve();
      return next.promise;
    },
    return() {
      returnCalls++;
      cleanupStarted.resolve();
      return cleanup.promise;
    },
  });
  const rendering = renderToString(source, { signal: controller.signal });
  await nextStarted.promise;
  controller.abort(reason);

  assertEquals(await rendering.catch((error) => error), reason);
  await cleanupStarted.promise;
  assertEquals(returnCalls, 1);
  cleanup.resolve(validReturn());
});

Deno.test("external stream abort interrupts pending component work", async () => {
  const controller = new AbortController();
  const reason = new DOMException("request ended", "AbortError");
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<Renderable>();

  function PendingComponent() {
    started.resolve();
    return pending.promise;
  }

  const reader = renderToStream(<PendingComponent />, {
    signal: controller.signal,
  }).getReader();
  const reading = reader.read();
  await started.promise;
  controller.abort(reason);

  assertEquals(await reading.catch((error) => error), reason);
  pending.resolve("late value");
});

Deno.test("external stream abort stays prompt with hanging iterator cleanup", async () => {
  const controller = new AbortController();
  const reason = new DOMException("request ended", "AbortError");
  const nextStarted = Promise.withResolvers<void>();
  const next = Promise.withResolvers<IteratorResult<Renderable>>();
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();

  const reader = renderToStream(
    asyncIterable({
      next() {
        nextStarted.resolve();
        return next.promise;
      },
      return() {
        cleanupStarted.resolve();
        return cleanup.promise;
      },
    }),
    { signal: controller.signal },
  ).getReader();
  const reading = reader.read();
  await nextStarted.promise;
  controller.abort(reason);

  assertEquals(await reading.catch((error) => error), reason);
  await cleanupStarted.promise;
  await assertPending(cleanup.promise);
  cleanup.resolve(validReturn());
});

Deno.test("cancel before reading is lazy, idempotent, and does no work", async () => {
  let componentCalls = 0;

  function DeferredComponent() {
    componentCalls++;
    return "never";
  }

  const reader = renderToStream(<DeferredComponent />).getReader();
  const firstCancel = reader.cancel("first");
  const secondCancel = reader.cancel("second");

  await Promise.all([firstCancel, secondCancel]);
  assertEquals(componentCalls, 0);
  await reader.cancel("third");
});

Deno.test("cancel interrupts a pending component promise", async () => {
  const started = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<Renderable>();

  function PendingComponent() {
    started.resolve();
    return pending.promise;
  }

  const reader = renderToStream(<PendingComponent />).getReader();
  const reading = reader.read();
  await started.promise;

  await reader.cancel("consumer stopped");
  assertEquals(await reading, { done: true, value: undefined });
  pending.resolve("late value");
});

Deno.test("cancel during pending next waits for async iterator cleanup", async () => {
  const nextStarted = Promise.withResolvers<void>();
  const next = Promise.withResolvers<IteratorResult<Renderable>>();
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();
  let returnCalls = 0;

  const reader = renderToStream(asyncIterable({
    next() {
      nextStarted.resolve();
      return next.promise;
    },
    return() {
      returnCalls++;
      cleanupStarted.resolve();
      return cleanup.promise;
    },
  })).getReader();
  const reading = reader.read();
  await nextStarted.promise;

  const cancelling = reader.cancel("consumer stopped");
  await cleanupStarted.promise;
  await assertPending(cancelling);
  assertEquals(returnCalls, 1);

  cleanup.resolve(validReturn());
  await cancelling;
  assertEquals(await reading, { done: true, value: undefined });
});

Deno.test("cancel after a prefix waits for hanging cleanup and calls return once", async () => {
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();
  let nextCalls = 0;
  let returnCalls = 0;

  const reader = renderToStream(asyncIterable({
    next() {
      nextCalls++;
      return Promise.resolve({ done: false, value: "prefix" });
    },
    return() {
      returnCalls++;
      cleanupStarted.resolve();
      return cleanup.promise;
    },
  })).getReader();
  assertEquals(new TextDecoder().decode((await reader.read()).value), "prefix");

  const firstCancel = reader.cancel("consumer stopped");
  const secondCancel = reader.cancel("again");
  await cleanupStarted.promise;
  await assertPending(firstCancel);
  await secondCancel;
  assertEquals(nextCalls, 1);
  assertEquals(returnCalls, 1);

  cleanup.resolve(validReturn());
  await Promise.all([firstCancel, secondCancel]);
});

Deno.test("cleanup rejection is observable when it is the only cancel failure", async () => {
  const cleanupFailure = new Error("return rejected");
  const reader = renderToStream(asyncIterable({
    next() {
      return Promise.resolve({ done: false, value: "prefix" });
    },
    return() {
      return Promise.reject(cleanupFailure);
    },
  })).getReader();
  await reader.read();

  assertEquals(
    await reader.cancel("consumer stopped").catch((error) => error),
    cleanupFailure,
  );
});

Deno.test("invalid return protocols reject reader.cancel when no failure precedes them", async () => {
  for (const mode of ["throwing-getter", "non-function"] as const) {
    const cause = new Error("return getter failed");
    const iterator = {
      next() {
        return Promise.resolve({ done: false, value: "prefix" });
      },
    } as Record<PropertyKey, unknown>;

    if (mode === "throwing-getter") {
      Object.defineProperty(iterator, "return", {
        get() {
          throw cause;
        },
      });
    } else {
      iterator.return = 1;
    }

    const reader = renderToStream(asyncIterable(iterator)).getReader();
    await reader.read();
    const error = await reader.cancel("consumer stopped").catch(
      (failure) => failure,
    );
    if (mode === "throwing-getter") {
      assertEquals(error, cause);
    } else {
      assertEquals(error instanceof TypeError, true);
    }
  }
});

Deno.test("cleanup rejection during a pending pull does not replace cancellation", async () => {
  const nextStarted = Promise.withResolvers<void>();
  const next = Promise.withResolvers<IteratorResult<Renderable>>();
  const cleanupFailure = new Error("return rejected");

  const reader = renderToStream(asyncIterable({
    next() {
      nextStarted.resolve();
      return next.promise;
    },
    return() {
      return Promise.reject(cleanupFailure);
    },
  })).getReader();
  const reading = reader.read();
  await nextStarted.promise;

  await reader.cancel("consumer stopped");
  assertEquals(await reading, { done: true, value: undefined });
});

Deno.test("cancellation wins over a later pending-next failure", async () => {
  const nextStarted = Promise.withResolvers<void>();
  const next = Promise.withResolvers<IteratorResult<Renderable>>();
  const cleanupStarted = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<IteratorResult<Renderable>>();
  let returnCalls = 0;

  const reader = renderToStream(asyncIterable({
    next() {
      nextStarted.resolve();
      return next.promise;
    },
    return() {
      returnCalls++;
      cleanupStarted.resolve();
      return cleanup.promise;
    },
  })).getReader();
  const reading = reader.read();
  await nextStarted.promise;

  const cancelling = reader.cancel("consumer stopped");
  await cleanupStarted.promise;
  next.reject(new Error("too late"));
  await assertPending(cancelling);
  cleanup.resolve(validReturn());
  await cancelling;
  assertEquals(await reading, { done: true, value: undefined });
  assertEquals(returnCalls, 1);
});

Deno.test("a stream failure remains primary when cancellation follows", async () => {
  const primary = new Error("next rejected");
  const reader = renderToStream(asyncIterable({
    next() {
      return Promise.reject(primary);
    },
    return() {
      return Promise.resolve(validReturn());
    },
  })).getReader();

  const streamError = await assertRejects(() => reader.read(), RenderError);
  assertEquals(streamError.cause, primary);
  assertEquals(
    await reader.cancel("after failure").catch((error) => error),
    streamError,
  );
});
