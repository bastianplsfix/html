import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  type Renderable,
  RenderError,
  renderToStream,
  renderToString,
} from "@bastianplsfix/html";

function renderable(value: unknown): Renderable {
  return value as Renderable;
}

async function renderFailure(value: Renderable): Promise<RenderError> {
  return await assertRejects(
    () => renderToString(value),
    RenderError,
  );
}

function asyncIterable(iterator: object): Renderable {
  return renderable({
    [Symbol.asyncIterator]() {
      return iterator;
    },
  });
}

function iterable(iterator: object): Renderable {
  return renderable({
    [Symbol.iterator]() {
      return iterator;
    },
  });
}

function validReturn() {
  return { done: true } as const;
}

Deno.test("throwing protocol getters retain their original causes and frames", async () => {
  for (
    const [name, key] of [
      ["then", "then"],
      ["async iterator", Symbol.asyncIterator],
      ["iterator", Symbol.iterator],
    ] as const
  ) {
    const cause = new Error(`${name} getter failed`);
    const hostile = Object.defineProperty({}, key, {
      get() {
        throw cause;
      },
    });

    const Hostile = () => renderable(hostile);

    const error = await renderFailure(<Hostile />);
    assertEquals(error.cause, cause);
    assertEquals(error.componentStack.map((frame) => frame.name), ["Hostile"]);
  }
});

Deno.test("non-function protocol values fail without being invoked", async () => {
  const plainThenable = await renderFailure(renderable({ then: 1 }));
  assertStringIncludes(plainThenable.message, "Cannot render an object");

  for (
    const [key, expected] of [
      [Symbol.asyncIterator, "Symbol.asyncIterator"],
      [Symbol.iterator, "Symbol.iterator"],
    ] as const
  ) {
    const error = await renderFailure(renderable({ [key]: 1 }));
    assert(error.cause instanceof TypeError);
    assertStringIncludes(error.message, `${expected} must be a function`);
  }

  let cleanedUp = false;
  const missingNext = await renderFailure(asyncIterable({
    next: 1,
    return() {
      cleanedUp = true;
      return validReturn();
    },
  }));
  assert(missingNext.cause instanceof TypeError);
  assertStringIncludes(missingNext.message, "next must be a function");
  assertEquals(cleanedUp, true);
});

Deno.test("throwing and invalid iterator factories become RenderError causes", async () => {
  for (const key of [Symbol.asyncIterator, Symbol.iterator] as const) {
    const cause = new Error("factory failed");
    const error = await renderFailure(renderable({
      [key]() {
        throw cause;
      },
    }));
    assertEquals(error.cause, cause);
  }

  for (const key of [Symbol.asyncIterator, Symbol.iterator] as const) {
    for (const result of [null, 1, "iterator"]) {
      const error = await renderFailure(renderable({
        [key]() {
          return result;
        },
      }));
      assert(error.cause instanceof TypeError);
      assertStringIncludes(error.message, "factory must return an object");
    }
  }
});

Deno.test("sync throws and rejected async next calls preserve the primary cause", async () => {
  for (const kind of ["sync", "async-sync", "async-rejected"] as const) {
    const cause = new Error(`${kind} next failed`);
    let cleanedUp = false;
    const iterator = {
      next() {
        if (kind === "async-rejected") {
          return Promise.reject(cause);
        }
        throw cause;
      },
      return() {
        cleanedUp = true;
        return kind === "sync" ? validReturn() : Promise.resolve(validReturn());
      },
    };
    const value = kind === "sync"
      ? iterable(iterator)
      : asyncIterable(iterator);

    const error = await renderFailure(value);
    assertEquals(error.cause, cause);
    assertEquals(cleanedUp, true);
  }
});

Deno.test("a throwing next getter still attempts iterator cleanup", async () => {
  const cause = new Error("next getter failed");
  let cleanedUp = false;
  const iterator = Object.defineProperties({}, {
    next: {
      get() {
        throw cause;
      },
    },
    return: {
      value() {
        cleanedUp = true;
        return validReturn();
      },
    },
  });

  const error = await renderFailure(iterable(iterator));
  assertEquals(error.cause, cause);
  assertEquals(cleanedUp, true);
});

Deno.test("invalid iterator results are rejected and closed", async () => {
  const invalidResults = [null, 0, "result", {}, { value: "missing done" }];

  for (const isAsync of [false, true]) {
    for (const invalidResult of invalidResults) {
      let cleanedUp = false;
      const iterator = {
        next() {
          return isAsync ? Promise.resolve(invalidResult) : invalidResult;
        },
        return() {
          cleanedUp = true;
          return isAsync ? Promise.resolve(validReturn()) : validReturn();
        },
      };
      const value = isAsync ? asyncIterable(iterator) : iterable(iterator);

      const error = await renderFailure(value);
      assert(error.cause instanceof TypeError);
      assertStringIncludes(error.message, "Iterator next() ");
      assertEquals(cleanedUp, true);
    }
  }
});

Deno.test("throwing iterator result accessors preserve their causes", async () => {
  for (const property of ["done", "value"] as const) {
    const cause = new Error(`${property} getter failed`);
    let cleanedUp = false;
    const result = property === "done"
      ? Object.defineProperty({}, "done", {
        get() {
          throw cause;
        },
      })
      : Object.defineProperties({}, {
        done: { value: false },
        value: {
          get() {
            throw cause;
          },
        },
      });

    const error = await renderFailure(iterable({
      next() {
        return result;
      },
      return() {
        cleanedUp = true;
        return validReturn();
      },
    }));
    assertEquals(error.cause, cause);
    assertEquals(cleanedUp, true);
  }
});

Deno.test("hostile thenables settle once and protocol getters are read once", async () => {
  let getterReads = 0;
  const thenable = Object.defineProperty({}, "then", {
    get() {
      getterReads++;
      return (
        resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
      ) => {
        resolve("<first>");
        resolve("second");
        reject(new Error("too late"));
        throw new Error("also too late");
      };
    },
  });

  assertEquals(await renderToString(renderable(thenable)), "&lt;first&gt;");
  assertEquals(getterReads, 1);
});

Deno.test("thenable rejection and invocation throws retain their causes", async () => {
  for (const mode of ["reject", "throw"] as const) {
    const cause = new Error(`${mode} was primary`);
    const thenable = {
      then(
        _resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
      ) {
        if (mode === "reject") {
          reject(cause);
          return;
        }
        throw cause;
      },
    };

    const error = await renderFailure(renderable(thenable));
    assertEquals(error.cause, cause);
  }
});

Deno.test("hostile non-Error rejection reasons remain the RenderError cause", async () => {
  const cause = Object.create(null) as Record<PropertyKey, unknown>;
  cause[Symbol.toPrimitive] = () => {
    throw new Error("coercion must not replace the rejection");
  };
  const error = await renderFailure(renderable({
    then(
      _resolve: (value: unknown) => void,
      reject: (reason: unknown) => void,
    ) {
      reject(cause);
    },
  }));

  assertEquals(error.cause, cause);
  assertStringIncludes(error.message, "non-Error value");
});

Deno.test("self-resolving and cyclic thenables fail instead of hanging", async () => {
  type HostileThenable = {
    then(resolve: (value: unknown) => void): void;
  };

  const self = {} as HostileThenable;
  self.then = (resolve) => resolve(self);
  const selfError = await renderFailure(renderable(self));
  assert(selfError.cause instanceof TypeError);
  assertStringIncludes(selfError.message, "cannot resolve to itself");

  const first = {} as HostileThenable;
  const second = {} as HostileThenable;
  first.then = (resolve) => resolve(second);
  second.then = (resolve) => resolve(first);
  const cycleError = await renderFailure(renderable(first));
  assert(cycleError.cause instanceof TypeError);
  assertStringIncludes(cycleError.message, "resolution cycle");
});

Deno.test("hostile thenables returned by async next are bounded and closed", async () => {
  type HostileThenable = {
    then(resolve: (value: unknown) => void): void;
  };
  const self = {} as HostileThenable;
  self.then = (resolve) => resolve(self);
  let cleanedUp = false;

  const error = await renderFailure(asyncIterable({
    next() {
      return self;
    },
    return() {
      cleanedUp = true;
      return Promise.resolve(validReturn());
    },
  }));
  assert(error.cause instanceof TypeError);
  assertStringIncludes(error.message, "cannot resolve to itself");
  assertEquals(cleanedUp, true);
});

Deno.test("cleanup rejection never replaces a framed primary failure", async () => {
  const primary = new Error("render failed");
  const cleanupFailure = new Error("cleanup failed");
  let cleanedUp = false;
  const source = asyncIterable({
    next() {
      return Promise.resolve({
        done: false,
        value: Promise.reject(primary),
      });
    },
    return() {
      cleanedUp = true;
      return Promise.reject(cleanupFailure);
    },
  });

  function HostileSource() {
    return source;
  }

  const error = await renderFailure(<HostileSource />);
  assertEquals(error.cause, primary);
  assertEquals(error.componentStack.map((frame) => frame.name), [
    "HostileSource",
  ]);
  assertEquals(cleanedUp, true);
});

Deno.test("throwing and non-function return protocols never replace primary", async () => {
  for (const mode of ["throwing-getter", "non-function"] as const) {
    const primary = new Error(`${mode} primary`);
    let returnReads = 0;
    const iterator = {
      next() {
        return { done: false, value: Promise.reject(primary) };
      },
    } as Record<PropertyKey, unknown>;

    if (mode === "throwing-getter") {
      Object.defineProperty(iterator, "return", {
        get() {
          returnReads++;
          throw new Error("return getter failed");
        },
      });
    } else {
      iterator.return = 1;
    }

    const error = await renderFailure(iterable(iterator));
    assertEquals(error.cause, primary);
    if (mode === "throwing-getter") {
      assertEquals(returnReads, 1);
    }
  }
});

Deno.test("nested cleanup failures never replace the innermost primary", async () => {
  const primary = new Error("inner render failed");
  const cleanupOrder: string[] = [];

  const inner = asyncIterable({
    next() {
      return Promise.resolve({ done: false, value: Promise.reject(primary) });
    },
    return() {
      cleanupOrder.push("inner");
      return Promise.reject(new Error("inner cleanup failed"));
    },
  });
  const outer = asyncIterable({
    next() {
      return Promise.resolve({ done: false, value: inner });
    },
    return() {
      cleanupOrder.push("outer");
      return Promise.reject(new Error("outer cleanup failed"));
    },
  });

  const error = await renderFailure(outer);
  assertEquals(error.cause, primary);
  assertEquals(cleanupOrder, ["inner", "outer"]);
});

Deno.test("protocol failures after a streamed prefix retain their cause", async () => {
  const cause = new Error("iterator getter failed");
  const hostile = Object.defineProperty({}, Symbol.iterator, {
    get() {
      throw cause;
    },
  });
  const reader = renderToStream(["prefix", renderable(hostile)]).getReader();
  assertEquals(new TextDecoder().decode((await reader.read()).value), "prefix");

  const error = await assertRejects(() => reader.read(), RenderError);
  assertEquals(error.cause, cause);
});
