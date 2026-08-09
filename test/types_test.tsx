import type { Children, Html } from "@bastianplsfix/html";

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
      <form accept-charset="utf-8">
        <input
          type="search"
          inputmode="search"
          enterkeyhint="search"
          writingsuggestions="false"
        />
      </form>
    </search>
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

// @ts-expect-error HTML enumerated attributes reject unknown values.
const invalidInputMode = <input inputmode="keyboard" />;

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
void invalidInputMode;
void invalidFormAlias;
void invalidSrcdoc;
void invalidArrayValue;
void invalidCustomEvent;
