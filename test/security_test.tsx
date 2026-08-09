import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { renderToString, scriptJSON, unsafeHTML } from "@bastianplsfix/html";
import {
  assertValidAttributeName,
  assertValidTagName,
  serializeAttribute,
} from "../src/escape.ts";
import {
  findDangerousUrlScheme,
  inspectUrlAttribute,
} from "../src/security.ts";
import { jsx } from "../jsx-runtime.ts";

Deno.test("text children escape an adversarial XSS corpus", async () => {
  const cases = [
    {
      value: `<script>alert("x")</script>`,
      expected: `&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;`,
    },
    {
      value: `</style><img src=x onerror='alert(1)'>`,
      expected: `&lt;/style&gt;&lt;img src=x onerror=&#39;alert(1)&#39;&gt;`,
    },
    {
      value: `<!--<svg/onload=alert(1)>-->&lt;script&gt;`,
      expected:
        `&lt;!--&lt;svg/onload=alert(1)&gt;--&gt;&amp;lt;script&amp;gt;`,
    },
    {
      value: `"><iframe srcdoc="<script>alert(1)</script>">`,
      expected:
        `&quot;&gt;&lt;iframe srcdoc=&quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot;&gt;`,
    },
  ];

  for (const { value, expected } of cases) {
    assertEquals(await renderToString(<p>{value}</p>), `<p>${expected}</p>`);
  }
});

Deno.test("quoted attributes escape an adversarial XSS corpus", async () => {
  const attacks = [
    `" autofocus onfocus="alert(1)`,
    `'><svg onload=alert(1)>`,
    `&quot; onmouseover=&quot;alert(1)`,
    "</textarea><script>alert(1)</script>",
  ];

  for (const attack of attacks) {
    const output = await renderToString(jsx("div", { title: attack }));
    assert(output.startsWith(`<div title="`));
    assert(output.endsWith(`"></div>`));
    assertEquals(output.includes("<script>"), false);
    assertEquals(output.includes("<svg"), false);
    assertEquals(output.includes(`title=""`), false);
  }
});

Deno.test("dynamic tag names cannot escape their markup boundary", () => {
  const invalidNames = [
    "",
    "1div",
    "/script",
    "div><script",
    "div onmouseover=alert(1)",
    "svg/onload",
    "div\nscript",
    "custom element",
    "élement",
  ];

  for (const name of invalidNames) {
    assertThrows(
      () => assertValidTagName(name),
      TypeError,
      "Invalid HTML tag name",
    );
  }
});

Deno.test("dynamic attribute names reject delimiters and control characters", () => {
  const invalidNames = [
    "",
    "bad name",
    "bad\tname",
    "bad\nname",
    "bad\0name",
    "bad/name",
    "bad=name",
    `bad"name`,
    "bad'name",
    "bad<name",
    "bad>name",
    `bad${String.fromCharCode(0x7f)}name`,
    `bad${String.fromCharCode(0x85)}name`,
    `bad${String.fromCharCode(0xd800)}name`,
  ];

  for (const name of invalidNames) {
    assertThrows(
      () => assertValidAttributeName(name),
      TypeError,
      "Invalid HTML attribute name",
    );
  }
});

Deno.test("inline event attributes fail closed after spreads bypass JSX types", async () => {
  for (const name of ["onclick", "onClick", "ONLOAD", "onpointerenter"]) {
    assertThrows(
      () => serializeAttribute(name, `alert("executed")`),
      TypeError,
      "inline event handlers execute JavaScript",
    );
  }

  const spread = { oNcLiC: `alert("executed")` };
  await assertRejects(
    () => renderToString(<button {...spread}>Unsafe</button>),
    TypeError,
    "inline event handlers execute JavaScript",
  );

  assertEquals(serializeAttribute("onclick", false), "");
});

Deno.test("srcdoc fails closed because escaped attributes are parsed as HTML", async () => {
  for (const name of ["srcdoc", "srcDoc", "SRCDOC"]) {
    assertThrows(
      () => serializeAttribute(name, `<script>alert("executed")</script>`),
      TypeError,
      "parse its value as HTML after decoding character references",
    );
  }

  const spread = { srcdoc: `<img src=x onerror="alert(1)">` };
  await assertRejects(
    () => renderToString(<iframe {...spread}></iframe>),
    TypeError,
    "parse its value as HTML after decoding character references",
  );

  assertEquals(serializeAttribute("srcdoc", undefined), "");
});

Deno.test("attribute serialization never invokes arbitrary object coercion", () => {
  let coerced = false;
  const value = {
    toString() {
      coerced = true;
      return `" onmouseover="alert(1)`;
    },
  };

  assertThrows(
    () => serializeAttribute("title", value),
    TypeError,
    "Cannot render an object",
  );
  assertEquals(coerced, false);
});

Deno.test("scriptJSON neutralizes raw-text terminators and HTML syntax", async () => {
  const value = {
    close: "</ScRiPt><script>alert(1)</script>",
    comment: "<!-- HTML comment -->",
    syntax: "<>&",
    separators: "\u2028\u2029",
  };
  const output = await renderToString(scriptJSON(value));

  assertEquals(output.includes("<"), false);
  assertEquals(output.includes(">"), false);
  assertEquals(output.includes("&"), false);
  assertEquals(output.includes("\u2028"), false);
  assertEquals(output.includes("\u2029"), false);
  assertStringIncludes(output, "\\u003C/ScRiPt\\u003E");
  assertStringIncludes(output, "\\u2028\\u2029");
  assertEquals(JSON.parse(output), value);
});

Deno.test("scriptJSON reports cycles, BigInts, and serialization failures", () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  const failure = new Error("toJSON failed");
  const throwing = {
    toJSON(): never {
      throw failure;
    },
  };

  for (const value of [1n, { nested: 1n }, cyclic, throwing]) {
    const error = assertThrows(
      () => scriptJSON(value),
      TypeError,
      "scriptJSON() could not serialize the value as JSON",
    );
    assert(error.cause !== undefined);
  }

  const error = assertThrows(() => scriptJSON(throwing), TypeError);
  assertEquals(error.cause, failure);
});

Deno.test("scriptJSON rejects root values with no JSON representation", () => {
  for (const value of [undefined, () => {}, Symbol("value")]) {
    assertThrows(
      () => scriptJSON(value),
      TypeError,
      "scriptJSON() received a value JSON cannot serialize",
    );
  }
});

Deno.test("unsafeHTML refuses object coercion at its explicit trust boundary", () => {
  let coerced = false;
  const value = {
    toString() {
      coerced = true;
      return "<script>alert(1)</script>";
    },
  };

  assertThrows(
    () => unsafeHTML(value as unknown as string),
    TypeError,
    "unsafeHTML() expects a string",
  );
  assertEquals(coerced, false);
});

Deno.test("dangerous URL scheme detection follows browser normalization", () => {
  const dangerous: Array<readonly [string, "javascript" | "vbscript"]> = [
    ["javascript:alert(1)", "javascript"],
    ["JAVASCRIPT:alert(1)", "javascript"],
    [" \u0000\u001fjavascript:alert(1)", "javascript"],
    ["java\nscript:alert(1)", "javascript"],
    ["j\ta\rv\na\tscript:alert(1)", "javascript"],
    ["vbscript:msgbox(1)", "vbscript"],
  ];

  for (const [value, expected] of dangerous) {
    assertEquals(findDangerousUrlScheme(value), expected);
  }

  for (
    const value of [
      "/javascript:alert(1)",
      "https://example.com/javascript:guide",
      "mailto:hello@example.com",
      "java script:alert(1)",
      "&#106;avascript:alert(1)",
      "%6Aavascript:alert(1)",
      "\uFEFFjavascript:alert(1)",
      "data:image/png;base64,AAAA",
    ]
  ) {
    assertEquals(findDangerousUrlScheme(value), undefined);
  }
});

Deno.test("URL attribute inspection returns immutable development diagnostics", () => {
  const warning = inspectUrlAttribute("HREF", "\njava\tscript:alert(1)");
  assert(warning);
  assertEquals(warning.code, "dangerous-url-scheme");
  assertEquals(warning.attributeName, "HREF");
  assertEquals(warning.scheme, "javascript");
  assert(Object.isFrozen(warning));
  assertStringIncludes(warning.message, "HTML escaping does not sanitize");

  assertEquals(
    inspectUrlAttribute(
      "srcset",
      "https://example.com/safe.png 1x, javascript:alert(1) 2x",
    )?.scheme,
    "javascript",
  );
  assertEquals(
    inspectUrlAttribute(
      "ping",
      "https://example.com/a vbscript:msgbox(1)",
    )?.scheme,
    "vbscript",
  );
  assertEquals(inspectUrlAttribute("href", "/safe"), undefined);
  assertEquals(inspectUrlAttribute("title", "javascript:alert(1)"), undefined);
  assertEquals(inspectUrlAttribute("href", 123), undefined);
});
