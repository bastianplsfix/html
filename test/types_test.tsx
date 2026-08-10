import type { Children, Html } from "@bastianplsfix/html";
import type { AriaAttributes, HTMLAttributes } from "../src/jsx_types.ts";

function Layout(
  { title, children }: { title: string; children: Children },
): Html {
  return (
    <html lang="en">
      <head>
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

async function AsyncMessage({ value }: { value: string }) {
  await Promise.resolve();
  return value;
}

const valid = (
  <Layout title="Types">
    <search>
      <form accept-charset="utf-8" rel="search">
        <input
          type="search"
          inputmode="search"
          enterkeyhint="search"
          writingsuggestions="false"
          capture="environment"
        />
      </form>
    </search>
    <selectedcontent />
    <input type="color" alpha colorspace="display-p3" />
    <template shadowrootmode="open" shadowrootclonable />
    <a
      attributionsrc="https://metrics.example/register-source"
      download
      href="/source"
    >
      Source
    </a>
    <iframe credentialless src="https://example.com"></iframe>
    <video controlslist="nodownload" disableremoteplayback></video>
    <div
      role="switch checkbox"
      aria-atomic="true"
      aria-braillelabel="Enabled"
      aria-description="Controls the setting"
      aria-live="polite"
      aria-relevant="additions text"
      aria-rowindextext="Row one"
    />
    <div role="doc-pagebreak" />
    <div contenteditable draggable spellcheck writingsuggestions />
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      autocomplete="email"
      readonly
      data-test-id="email"
      aria-label="Email address"
    />
    <meta http-equiv="refresh" content="30" />
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      aria-labelledby="icon-title"
    >
      <title id="icon-title">Typed SVG</title>
      <defs>
        <linearGradient
          id="paint"
          gradientUnits="userSpaceOnUse"
          gradientTransform="rotate(45)"
        >
          <stop offset="0%" stop-color="#335cff" stop-opacity={0.5} />
          <stop offset="100%" stop-color="#00aeff" />
        </linearGradient>
        <filter id="blur" filterUnits="userSpaceOnUse">
          <feGaussianBlur in="SourceGraphic" stdDeviation={2} />
          <feDropShadow dx={1} dy="2px" stdDeviation="2 3" />
          <feColorMatrix type="matrix" values="1 0 0 0 0" />
        </filter>
        <clipPath id="clip" clipPathUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={10} />
        </clipPath>
      </defs>
      <g clip-path="url(#clip)" filter="url(#blur)">
        <a href="/icons" fill="currentColor" stroke-width={1}>
          linked icon
        </a>
        <path
          d="M2 12h20"
          fill="url(#paint)"
          fill-rule="evenodd"
          marker-end="url(#arrow)"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width={2}
          vector-effect="non-scaling-stroke"
        />
        <text text-anchor="middle">
          <textPath href="#curve" startOffset="50%">label</textPath>
        </text>
        <animate
          attributeName="opacity"
          dur="1s"
          repeatCount="indefinite"
        />
      </g>
      <use href="#shape" xlink:href="#legacy-shape" />
    </svg>
    <user-avatar user-id="123">Profile</user-avatar>
    <AsyncMessage value="safe text" />
  </Layout>
);

// @ts-expect-error `href` is not an image attribute.
const invalidImage = <img href="/image.png" />;

// @ts-expect-error `href` is not an input attribute.
const invalidInput = <input href="/account" />;

// @ts-expect-error client event handler props are not part of this runtime.
const invalidEvent = <button type="button" onClick={() => {}}>Click</button>;

const invalidInlineEvent = (
  // @ts-expect-error inline event-handler attributes are intentionally absent.
  <button type="button" onclick="alert(1)">Click</button>
);

// @ts-expect-error React's `className` alias is not an HTML attribute.
const invalidClassAlias = <div className="card" />;

// @ts-expect-error React's `htmlFor` alias is not an HTML attribute.
const invalidForAlias = <label htmlFor="email">Email</label>;

// @ts-expect-error SVG attributes use their serialized names, not React aliases.
const invalidSvgAlias = <path strokeLinecap="round" />;

// @ts-expect-error client event handler props are absent from SVG elements too.
const invalidSvgEvent = <svg onClick={() => {}} />;

// @ts-expect-error unknown SVG attributes are rejected.
const invalidSvgAttribute = <path definitelyNotSvg="value" />;

// @ts-expect-error SVG attributes are scoped to the elements that define them.
const invalidScopedSvgAttribute = <circle stdDeviation={2} />;

// @ts-expect-error SVG attribute casing is the serialized native spelling.
const invalidSvgCasing = <svg viewbox="0 0 24 24" />;

// @ts-expect-error HTML enumerated attributes reject unknown values.
const invalidInputMode = <input inputmode="keyboard" />;

// @ts-expect-error current color inputs expose the serialized colorspace tokens.
const invalidColorSpace = <input type="color" colorspace="adobe-rgb" />;

// @ts-expect-error unknown ARIA attributes are rejected on built-in elements.
const invalidAriaName: HTMLAttributes = { "aria-labl": "Typo" };

// @ts-expect-error ARIA enumerated attributes reject unknown tokens.
const invalidAriaValue = <div aria-live="loud" />;

// @ts-expect-error abstract ARIA roles are not usable role values.
const invalidAriaRole = <div role="widget" />;

// @ts-expect-error ARIA booleans are serialized string tokens, not bare attrs.
const invalidAriaBoolean: AriaAttributes = { "aria-atomic": true };

// @ts-expect-error use the serialized `accept-charset` HTML name.
const invalidFormAlias = <form acceptcharset="utf-8" />;

// @ts-expect-error srcdoc creates a nested HTML context and is not serializable.
const invalidSrcdoc = <iframe srcdoc="<p>nested markup</p>"></iframe>;

// @ts-expect-error attribute objects are rejected by the server serializer.
const invalidArrayValue = <input value={["one", "two"]} />;

// @ts-expect-error custom-element attributes cannot contain functions either.
const invalidCustomEvent = <user-avatar onready={() => {}} />;

void valid;
void invalidImage;
void invalidInput;
void invalidEvent;
void invalidInlineEvent;
void invalidClassAlias;
void invalidForAlias;
void invalidSvgAlias;
void invalidSvgEvent;
void invalidSvgAttribute;
void invalidScopedSvgAttribute;
void invalidSvgCasing;
void invalidInputMode;
void invalidColorSpace;
void invalidAriaName;
void invalidAriaValue;
void invalidAriaRole;
void invalidAriaBoolean;
void invalidFormAlias;
void invalidSrcdoc;
void invalidArrayValue;
void invalidCustomEvent;
