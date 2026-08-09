/** URL schemes that execute script rather than navigate to ordinary content. */
export type DangerousUrlScheme = "javascript" | "vbscript";

/** A non-fatal security diagnostic discovered while inspecting an attribute. */
export interface SecurityWarning {
  /** Stable identifier suitable for programmatic warning handling. */
  readonly code: "dangerous-url-scheme";
  /** HTML attribute that caused the warning. */
  readonly attributeName: string;
  /** Executable URL scheme found after browser-style normalization. */
  readonly scheme: DangerousUrlScheme;
  /** Original, unmodified attribute value. */
  readonly value: string;
  /** Human-readable explanation of the warning and its security boundary. */
  readonly message: string;
}

const URL_ATTRIBUTES = new Set([
  "action",
  "cite",
  "data",
  "formaction",
  "href",
  "longdesc",
  "manifest",
  "ping",
  "poster",
  "src",
  "srcset",
  "usemap",
  "xlink:href",
  "xlinkhref",
]);

const SPACE_SEPARATED_URL_ATTRIBUTES = new Set(["ping"]);
const COMMA_SEPARATED_URL_ATTRIBUTES = new Set(["srcset"]);

/**
 * Return an executable URL scheme, including forms browsers normalize first.
 *
 * The URL Standard removes leading C0 controls and spaces and removes tab,
 * carriage-return, and line-feed characters from URLs before parsing them.
 */
export function findDangerousUrlScheme(
  value: string,
): DangerousUrlScheme | undefined {
  const normalized = normalizeUrlForSchemeDetection(value);
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/u.exec(normalized)?.[1]
    ?.toLowerCase();

  return scheme === "javascript" || scheme === "vbscript" ? scheme : undefined;
}

/**
 * Inspect a URL-valued HTML attribute without logging or mutating global state.
 *
 * A renderer can call this in development mode and send the returned value to
 * an application-provided warning callback.
 */
export function inspectUrlAttribute(
  attributeName: string,
  value: unknown,
): SecurityWarning | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedName = attributeName.toLowerCase();
  if (!URL_ATTRIBUTES.has(normalizedName)) {
    return undefined;
  }

  for (const candidate of urlCandidates(normalizedName, value)) {
    const scheme = findDangerousUrlScheme(candidate);
    if (scheme) {
      return Object.freeze({
        code: "dangerous-url-scheme",
        attributeName,
        scheme,
        value,
        message: `The ${
          JSON.stringify(attributeName)
        } attribute contains a potentially dangerous ${scheme}: URL. HTML escaping does not sanitize URL schemes.`,
      });
    }
  }

  return undefined;
}

function urlCandidates(
  attributeName: string,
  value: string,
): readonly string[] {
  if (SPACE_SEPARATED_URL_ATTRIBUTES.has(attributeName)) {
    return value.split(/[\t\n\f\r ]+/u);
  }

  if (COMMA_SEPARATED_URL_ATTRIBUTES.has(attributeName)) {
    return value.split(",");
  }

  return [value];
}

function normalizeUrlForSchemeDetection(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) <= 0x20) {
    start++;
  }

  let normalized = "";
  for (let index = start; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      normalized += value[index];
    }
  }

  return normalized;
}
