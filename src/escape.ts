const VALID_TAG_NAME = /^[A-Za-z][A-Za-z0-9._:-]*$/u;

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
    character.charCodeAt(0) <= 0x20 || `"'<>/=`.includes(character)
  );

  if (name.length === 0 || invalid) {
    throw new TypeError(
      `Invalid HTML attribute name: ${JSON.stringify(name)}.`,
    );
  }
}

export function serializeAttribute(name: string, value: unknown): string {
  assertValidAttributeName(name);

  if (name === "key") {
    return "";
  }

  if (value === null || value === undefined || value === false) {
    return "";
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
