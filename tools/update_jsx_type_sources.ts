/**
 * Refresh the normalized, pinned source snapshot used by the JSX type generator.
 *
 * Ordinary generation never calls this script and never needs network access.
 */

const WEBREF_ELEMENTS_VERSION = "2.7.1";
const WEBREF_IDL_VERSION = "3.82.1";
const ARIA_COMMIT = "d67661624b0a49d653658c6d0d77113247ca4d27";

type SourceArtifact = {
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
  readonly license: string;
};

const artifacts = [
  {
    id: "webref-html-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/html.json`,
    sha256: "56030c8bb725c6009e17ca85ef729aa4cecb9f51926a9ef870f36c5ecb37dfd0",
    license: "MIT",
  },
  {
    id: "webref-svg2-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/SVG2.json`,
    sha256: "c166070010fcabfade38b2ff79e108f249a2d13e4e77fd11787f98957c7b546c",
    license: "MIT",
  },
  {
    id: "webref-svg-animation-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/svg-animations.json`,
    sha256: "c6d0dbc91f9dea61f4d319316562d45b2ead473085fada3e4fba63c4e6018e3c",
    license: "MIT",
  },
  {
    id: "webref-svg-path-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/svg-paths.json`,
    sha256: "716c25f06e696890c28fe0a52c17a70f33f12f2c9bf682a6a6a527c6cdcf3d7a",
    license: "MIT",
  },
  {
    id: "webref-svg-filter-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/filter-effects-1.json`,
    sha256: "1c7949b084899b996923a3d74ae9fe8c6e3f2c64c656742063cc9d05b410df49",
    license: "MIT",
  },
  {
    id: "webref-svg-masking-elements",
    url:
      `https://unpkg.com/@webref/elements@${WEBREF_ELEMENTS_VERSION}/css-masking-1.json`,
    sha256: "3106227b4af6a1f5ff3133dce28832c0cceb8d5558c22102fa75c9a690763841",
    license: "MIT",
  },
  {
    id: "html-element-attributes",
    url: "https://unpkg.com/html-element-attributes@3.5.0/index.js",
    sha256: "2ccbc831892fa3a6044dc07c94cde5aaa7bf053f491516c2f7f0a27d5940b1a2",
    license: "MIT",
  },
  {
    id: "svg-element-attributes",
    url: "https://unpkg.com/svg-element-attributes@2.2.0/index.js",
    sha256: "88ba80b7afdf516b0659976c7ed6b4407a4df597d5deb5fcc61b93a87daf5418",
    license: "MIT",
  },
  {
    id: "webref-wai-aria-idl",
    url: `https://unpkg.com/@webref/idl@${WEBREF_IDL_VERSION}/wai-aria.idl`,
    sha256: "6374610e116702a2ddc188d237567627f04f9e00de4e2f9e1907b2a903717d48",
    license: "MIT; source specification uses the W3C Document License",
  },
  {
    id: "w3c-aria-role-info",
    url:
      `https://raw.githubusercontent.com/w3c/aria/${ARIA_COMMIT}/common/script/roleInfo.js`,
    sha256: "44e075af39bbfad54e470124d2cb3937606ee62a42a7efb72543cc559e6e6b70",
    license: "W3C Document License",
  },
] as const satisfies readonly SourceArtifact[];

const abstractAriaRoles = new Set([
  "command",
  "composite",
  "input",
  "landmark",
  "range",
  "roletype",
  "section",
  "sectionhead",
  "select",
  "structure",
  "widget",
  "window",
]);

type WebrefElement = {
  readonly name: string;
  readonly interface?: string;
  readonly href: string;
  readonly obsolete?: boolean;
};

type WebrefElements = {
  readonly spec: {
    readonly title: string;
    readonly url: string;
  };
  readonly elements: readonly WebrefElement[];
};

type NormalizedElement = {
  readonly name: string;
  readonly interface?: string;
  readonly href: string;
  readonly obsolete: boolean;
  readonly source: string;
};

type AttributeMap = Readonly<Record<string, readonly string[]>>;

const fetched = new Map<string, Uint8Array>();
for (const artifact of artifacts) {
  fetched.set(artifact.id, await fetchVerified(artifact));
}

const htmlElements = parseJson<WebrefElements>("webref-html-elements");
const svgElementSources = [
  "webref-svg2-elements",
  "webref-svg-animation-elements",
  "webref-svg-path-elements",
  "webref-svg-filter-elements",
  "webref-svg-masking-elements",
].map((id) => [id, parseJson<WebrefElements>(id)] as const);

const htmlAttributeModule = await parseModule("html-element-attributes");
const svgAttributeModule = await parseModule("svg-element-attributes");
const htmlAttributes = normalizeAttributeMap(
  assertAttributeMap(htmlAttributeModule.htmlElementAttributes),
);
const rawSvgAttributes = normalizeAttributeMap(
  assertAttributeMap(svgAttributeModule.svgElementAttributes),
);

const normalizedHtmlElements = htmlElements.elements
  .map((element) => normalizeElement(element, "webref-html-elements"))
  .sort(compareByName);
const normalizedSvgElements = mergeElements(svgElementSources);
const svgNames = new Set(normalizedSvgElements.map((element) => element.name));
const svgAttributes = Object.fromEntries(
  Object.entries(rawSvgAttributes).filter(([name]) =>
    name === "*" || svgNames.has(name)
  ),
);

const ariaIdl = decode("webref-wai-aria-idl");
const ariaAttributes = parseAriaAttributes(ariaIdl);
const roleInfo = decode("w3c-aria-role-info");
const ariaRoles = parseAriaRoles(roleInfo).map((name) => ({
  name,
  abstract: abstractAriaRoles.has(name),
}));

const snapshot = {
  schemaVersion: 1,
  provenance: {
    webrefElementsVersion: WEBREF_ELEMENTS_VERSION,
    webrefIdlVersion: WEBREF_IDL_VERSION,
    ariaCommit: ARIA_COMMIT,
    artifacts,
  },
  html: {
    spec: htmlElements.spec,
    elements: normalizedHtmlElements,
    attributes: htmlAttributes,
  },
  svg: {
    elements: normalizedSvgElements,
    attributes: svgAttributes,
  },
  aria: {
    specification: "https://w3c.github.io/aria/",
    attributes: ariaAttributes,
    roles: ariaRoles,
  },
};

const output = new URL("./jsx-types/source-data.json", import.meta.url);
await Deno.writeTextFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Updated ${output.pathname}`);

async function fetchVerified(
  artifact: SourceArtifact,
): Promise<Uint8Array> {
  const response = await fetch(artifact.url);
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${artifact.url}: ${response.status} ${response.statusText}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = await sha256(bytes);
  if (actual !== artifact.sha256) {
    throw new Error(
      `Integrity mismatch for ${artifact.id}: expected ${artifact.sha256}, received ${actual}`,
    );
  }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  // Copy into an ArrayBuffer-backed view. This satisfies both Deno's TS 5.6
  // BufferSource declarations and TS 6's generic typed-array declarations.
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", input.buffer),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decode(id: string): string {
  const bytes = fetched.get(id);
  if (!bytes) throw new Error(`Missing fetched artifact ${id}.`);
  return new TextDecoder().decode(bytes);
}

function parseJson<Value>(id: string): Value {
  return JSON.parse(decode(id)) as Value;
}

async function parseModule(id: string): Promise<Record<string, unknown>> {
  const bytes = fetched.get(id);
  if (!bytes) throw new Error(`Missing fetched artifact ${id}.`);
  const dataUrl = `data:text/javascript;base64,${encodeBase64(bytes)}`;
  return await import(dataUrl) as Record<string, unknown>;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function assertAttributeMap(value: unknown): AttributeMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an element-to-attributes object.");
  }

  for (const [element, attributes] of Object.entries(value)) {
    if (
      !Array.isArray(attributes) ||
      attributes.some((attribute) => typeof attribute !== "string")
    ) {
      throw new Error(`Invalid attribute list for ${element}.`);
    }
  }
  return value as AttributeMap;
}

function normalizeAttributeMap(input: AttributeMap): AttributeMap {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => compareStrings(left, right))
      .map(([element, attributes]) => [
        element,
        [...new Set(attributes)].sort(compareStrings),
      ]),
  );
}

function normalizeElement(
  element: WebrefElement,
  source: string,
): NormalizedElement {
  return {
    name: element.name,
    ...(element.interface ? { interface: element.interface } : {}),
    href: element.href,
    obsolete: element.obsolete === true,
    source,
  };
}

function mergeElements(
  sources: readonly (readonly [string, WebrefElements])[],
): readonly NormalizedElement[] {
  const elements = new Map<string, NormalizedElement>();
  for (const [source, data] of sources) {
    for (const element of data.elements) {
      if (!elements.has(element.name)) {
        elements.set(element.name, normalizeElement(element, source));
      }
    }
  }
  return [...elements.values()].sort(compareByName);
}

function compareByName(
  left: { readonly name: string },
  right: { readonly name: string },
): number {
  return compareStrings(left.name, right.name);
}

function parseAriaAttributes(idl: string): readonly string[] {
  const attributes = new Set<string>();
  const pattern =
    /\[CEReactions,\s*Reflect(?:="([^"]+)")?\][^;\n]*\battribute\s+[^;\n]+?\s+([A-Za-z][A-Za-z0-9]*)\s*;/gu;
  for (const match of idl.matchAll(pattern)) {
    const reflectedName = match[1] ?? match[2].toLowerCase();
    if (reflectedName === "role" || reflectedName.startsWith("aria-")) {
      attributes.add(reflectedName);
    }
  }
  return [...attributes].sort(compareStrings);
}

function parseAriaRoles(roleInfo: string): readonly string[] {
  const roles = new Set<string>();
  for (const match of roleInfo.matchAll(/^[ ]{2}([a-z][a-z0-9-]*): \{$/gmu)) {
    roles.add(match[1]);
  }
  return [...roles].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
