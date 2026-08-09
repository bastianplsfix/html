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
      <path fill="currentColor" />
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

void valid;
void invalidImage;
void invalidInput;
void invalidEvent;
