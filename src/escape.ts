const VALID_TAG_NAME = /^[A-Za-z][A-Za-z0-9._:-]*$/u;
const INLINE_EVENT_HANDLER = /^on/iu;
const BOOLEANISH_HTML_ATTRIBUTES = new Set([
  "contenteditable",
  "draggable",
  "spellcheck",
  "writingsuggestions",
]);

/** Escape a value for an HTML text context. */
export function escapeText(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    },
  );
}

/** Escape a value for a double-quoted HTML attribute context. */
export function escapeAttribute(value: string): string {
  return escapeText(value);
}

export function assertValidTagName(name: string): void {
  if (!VALID_TAG_NAME.test(name)) {
    throw new TypeError(`Invalid HTML tag name: ${JSON.stringify(name)}.`);
  }
}

export function assertValidAttributeName(name: string): void {
  const invalid = [...name].some((character) =>
    isControlCharacter(character) || `"'<>/=`.includes(character)
  );

  if (name.length === 0 || invalid) {
    throw new TypeError(
      `Invalid HTML attribute name: ${JSON.stringify(name)}.`,
    );
  }
}

export function serializeAttribute(name: string, value: unknown): string {
  assertValidAttributeName(name);

  const normalizedName = name.toLowerCase();

  if (name === "key") {
    return "";
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "boolean" &&
    BOOLEANISH_HTML_ATTRIBUTES.has(normalizedName)
  ) {
    return `${name}="${value}"`;
  }

  if (value === false) {
    return "";
  }

  if (INLINE_EVENT_HANDLER.test(normalizedName)) {
    throw new TypeError(
      `Cannot render the ${
        JSON.stringify(name)
      } attribute because inline event handlers execute JavaScript.`,
    );
  }

  if (normalizedName === "srcdoc") {
    throw new TypeError(
      "Cannot render the srcdoc attribute because browsers parse its value as HTML after decoding character references.",
    );
  }

  if (name === "ref") {
    throw new TypeError(
      "The ref prop has no meaning in server-only HTML components.",
    );
  }

  if (value === true) {
    return name;
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "bigint":
      return `${name}="${escapeAttribute(String(value))}"`;
    case "function":
      throw new TypeError(
        `Cannot render a function as the ${JSON.stringify(name)} attribute.`,
      );
    case "symbol":
      throw new TypeError(
        `Cannot render a symbol as the ${JSON.stringify(name)} attribute.`,
      );
    case "object":
      throw new TypeError(
        `Cannot render an object as the ${JSON.stringify(name)} attribute.`,
      );
    default:
      throw new TypeError(
        `Cannot render ${typeof value} as the ${
          JSON.stringify(name)
        } attribute.`,
      );
  }
}

function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0)!;
  return codePoint <= 0x20 ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff);
}
