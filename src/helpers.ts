import { type Html, rawNode } from "./model.ts";

const DOCTYPE = rawNode("<!doctype html>");

/** Return the HTML5 doctype as trusted markup. */
export function doctype(): Html {
  return DOCTYPE;
}

/**
 * Mark a string as trusted HTML, bypassing all escaping.
 *
 * Only use this with markup that is already trusted or sanitized.
 */
export function unsafeHTML(value: string): Html {
  if (typeof value !== "string") {
    throw new TypeError("unsafeHTML() expects a string.");
  }

  return rawNode(value);
}

/** Serialize data for an HTML `<script>` raw-text context. */
export function scriptJSON(value: unknown): Html {
  let json: string | undefined;

  try {
    json = JSON.stringify(value);
  } catch (cause) {
    throw new TypeError(
      "scriptJSON() could not serialize the value as JSON.",
      { cause },
    );
  }

  if (json === undefined) {
    throw new TypeError("scriptJSON() received a value JSON cannot serialize.");
  }

  return rawNode(
    json.replace(
      /[<>&\u2028\u2029]/gu,
      (character) => {
        switch (character) {
          case "<":
            return "\\u003C";
          case ">":
            return "\\u003E";
          case "&":
            return "\\u0026";
          case "\u2028":
            return "\\u2028";
          default:
            return "\\u2029";
        }
      },
    ),
  );
}
