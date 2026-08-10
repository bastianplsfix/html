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
    <svg viewBox="0 0 24 24">
      <circle cx={12} cy={12} r={10} stroke-width={2} />
      <path d="M3 12h18" fill="currentColor" fill-rule="evenodd" />
      <use href="#icon" xlink:href="#legacy-icon" />
    </svg>
    <user-avatar
      user-id="123"
      data-state="ready"
      aria-label="User profile"
      disabled={false}
    >
      Profile
    </user-avatar>
    <AsyncMessage value="safe text" />
  </Layout>
);

// @ts-expect-error `href` is not an image attribute.
const invalidImage = <img href="/image.png" />;

// @ts-expect-error `href` is not an input attribute.
const invalidInput = <input href="/account" />;

// @ts-expect-error client event handler props are not part of this runtime.
const invalidEvent = <button type="button" onClick={() => {}}>Click</button>;

// @ts-expect-error SVG attributes use native serialized names, not DOM aliases.
const invalidSvgAlias = <path strokeWidth={2} />;

// @ts-expect-error `d` only applies to SVG path elements.
const invalidSvgCircle = <circle d="M0 0" />;

// @ts-expect-error declared custom-element values must be scalar.
const invalidCustomObject = <user-avatar value={{ id: "123" }} />;

// @ts-expect-error declared custom-element values cannot be callbacks.
const invalidCustomEvent = <user-avatar value={() => {}} />;

// @ts-expect-error application-specific custom attributes use hyphenated names.
const invalidCustomAlias = <user-avatar userId="123" />;

void valid;
void invalidImage;
void invalidInput;
void invalidEvent;
void invalidSvgAlias;
void invalidSvgCircle;
void invalidCustomObject;
void invalidCustomEvent;
void invalidCustomAlias;
