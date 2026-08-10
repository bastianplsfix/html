import { assert, assertEquals, assertThrows } from "@std/assert";
import { renderToString } from "@bastianplsfix/html";
import {
  assertValidAttributeName,
  escapeAttribute,
  escapeText,
  serializeAttribute,
} from "../src/escape.ts";

const ENTITY_BY_CHARACTER: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

Deno.test("escaping covers nulls and every ASCII control deterministically", () => {
  const ascii = String.fromCharCode(
    ...Array.from({ length: 128 }, (_, code) => code),
  );
  const expected = referenceEscape(ascii);

  assertEquals(escapeText(ascii), expected);
  assertEquals(escapeAttribute(ascii), expected);
  assertEquals(escapeText("\0<&"), "\0&lt;&amp;");
});

Deno.test("escaping preserves Unicode code units outside HTML delimiters", () => {
  const astral = "😀𝄞𐀀";
  const loneSurrogates = "\uD800a\uDBFFb\uDC00c\uDFFF";
  const noncharacters = [
    0xFDD0,
    0xFDEF,
    0xFFFE,
    0xFFFF,
    0x1FFFE,
    0x1FFFF,
    0x10FFFE,
    0x10FFFF,
  ].map((codePoint) => String.fromCodePoint(codePoint)).join("");
  const value = `${astral}|${loneSurrogates}|${noncharacters}|<&`;

  assertEquals(escapeText(value), `${value.slice(0, -2)}&lt;&amp;`);
  assertEquals(escapeAttribute(value), referenceEscape(value));
});

Deno.test("each sensitive character escapes correctly when heavily repeated", () => {
  const repetitions = 65_536;

  for (const [character, entity] of Object.entries(ENTITY_BY_CHARACTER)) {
    assertEquals(
      escapeText(character.repeat(repetitions)),
      entity.repeat(repetitions),
    );
  }
});

Deno.test("very large text and attribute values remain complete", async () => {
  const unit = `plain<&>"'😀\0`;
  const value = unit.repeat(Math.ceil((1024 * 1024) / unit.length));
  const escaped = referenceEscape(value);

  assertEquals(escapeText(value), escaped);
  assertEquals(escapeAttribute(value), escaped);
  assertEquals(
    serializeAttribute("data-payload", value),
    `data-payload="${escaped}"`,
  );
  assertEquals(
    await renderToString(<p title={value}>{value}</p>),
    `<p title="${escaped}">${escaped}</p>`,
  );
});

Deno.test("escaping matches a reference implementation for arbitrary UTF-16", () => {
  const random = deterministicRandom(0xC0DE_5EED);

  for (let caseIndex = 0; caseIndex < 1_024; caseIndex++) {
    const length = random() % 257;
    const codeUnits = Array.from(
      { length },
      () => random() & 0xFFFF,
    );
    const value = String.fromCharCode(...codeUnits);
    const expected = referenceEscape(value);

    assertEquals(escapeText(value), expected);
    assertEquals(escapeAttribute(value), expected);
  }
});

Deno.test("every forbidden attribute-name code unit is rejected", () => {
  const forbidden = new Set<number>();

  for (let code = 0x00; code <= 0x20; code++) {
    forbidden.add(code);
  }
  for (let code = 0x7F; code <= 0x9F; code++) {
    forbidden.add(code);
  }
  for (let code = 0xD800; code <= 0xDFFF; code++) {
    forbidden.add(code);
  }
  for (const character of `"'<>\u002F=`) {
    forbidden.add(character.charCodeAt(0));
  }

  for (const codeUnit of forbidden) {
    const name = `data-${String.fromCharCode(codeUnit)}-value`;
    assertThrows(
      () => assertValidAttributeName(name),
      TypeError,
      "Invalid HTML attribute name",
    );
  }
});

Deno.test("valid astral and very long attribute names serialize intact", () => {
  const astralName = "data-😀-value";
  assertValidAttributeName(astralName);
  assertEquals(
    serializeAttribute(astralName, "ready"),
    `${astralName}="ready"`,
  );

  const longName = `data-${"segment-".repeat(16_384)}end`;
  assert(longName.length > 100_000);
  assertValidAttributeName(longName);
  assertEquals(
    serializeAttribute(longName, "value"),
    `${longName}="value"`,
  );
});

function referenceEscape(value: string): string {
  let escaped = "";

  for (const character of value) {
    escaped += ENTITY_BY_CHARACTER[character] ?? character;
  }

  return escaped;
}

function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}
