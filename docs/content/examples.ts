export const CONFIG_CODE = [
  "{",
  '  "compilerOptions": {',
  '    "jsx": "precompile",',
  '    "jsxImportSource": "@bastianplsfix/html",',
  '    "jsxPrecompileSkipElements": ["script", "style"]',
  "  },",
  '  "imports": {',
  '    "@bastianplsfix/html": "jsr:@bastianplsfix/html@^0.2.0"',
  "  },",
  '  "lint": {',
  '    "rules": {',
  '      "exclude": ["jsx-key"]',
  "    }",
  "  }",
  "}",
].join("\n");

export const HELLO_CODE = [
  'import { doctype, renderToString } from "@bastianplsfix/html";',
  "",
  "const view = (",
  "  <>",
  "    {doctype()}",
  '    <html lang="en">',
  "      <head><title>Hello</title></head>",
  "      <body>",
  "        <h1>Hello from Deno</h1>",
  "      </body>",
  "    </html>",
  "  </>",
  ");",
  "",
  "const body = await renderToString(view);",
].join("\n");

export const SERVER_CODE = [
  'import { html } from "@bastianplsfix/html/response";',
  "",
  "export default {",
  "  fetch(request) {",
  "    const url = new URL(request.url);",
  "",
  '    if (url.pathname !== "/") {',
  '      return new Response("Not found", { status: 404 });',
  "    }",
  "",
  "    return html(",
  "      <main>",
  "        <h1>Your first page</h1>",
  "        <p>No client runtime was shipped.</p>",
  "      </main>,",
  "    );",
  "  },",
  "} satisfies Deno.ServeDefaultExport;",
].join("\n");

export const COMPONENT_CODE = [
  "type GreetingProps = {",
  "  name: string;",
  "};",
  "",
  "function Greeting({ name }: GreetingProps) {",
  "  return <p>Hello, {name}.</p>;",
  "}",
  "",
  "const view = <Greeting name={user.name} />;",
].join("\n");

export const ASYNC_CODE = [
  "async function UserBadge({ userId }: { userId: string }) {",
  "  const user = await findUser(userId);",
  "",
  "  if (!user) return <span>Unknown user</span>;",
  "",
  "  return (",
  "    <a href={`/users/${user.id}`}>",
  "      {user.name}",
  "    </a>",
  "  );",
  "}",
  "",
  'const view = <UserBadge userId="123" />;',
].join("\n");

export const STREAM_CODE = [
  'import { renderToStream } from "@bastianplsfix/html";',
  "",
  "const body = renderToStream(<Page />, {",
  "  signal: request.signal,",
  "});",
  "",
  "return new Response(body, {",
  '  headers: { "content-type": "text/html; charset=utf-8" },',
  "});",
].join("\n");

export const DEV_CONFIG_CODE = [
  "{",
  '  "compilerOptions": {',
  '    "jsx": "react-jsxdev",',
  '    "jsxImportSource": "@bastianplsfix/html"',
  "  }",
  "}",
].join("\n");

export const ESCAPING_CODE = [
  'const query = `<script>alert("hello")</script>`;',
  "const view = <p>{query}</p>;",
  "",
  "await renderToString(view);",
  "// <p>&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;</p>",
].join("\n");

export const ATTRIBUTE_CODE = [
  'const value = `" onmouseover="alert(1)`;',
  "const view = <input value={value} />;",
  "",
  "await renderToString(view);",
  '// <input value="&quot; onmouseover=&quot;alert(1)">',
].join("\n");

export const UNSAFE_CODE = [
  'import { unsafeHTML } from "@bastianplsfix/html";',
  "",
  "const sanitized = markdownToHTML(source);",
  "return <article>{unsafeHTML(sanitized)}</article>;",
].join("\n");

export const JSON_CODE = [
  'import { scriptJSON } from "@bastianplsfix/html";',
  "",
  'const state = { returnTo: "</script><script>attack()</script>" };',
  "",
  "return (",
  '  <script type="application/json" id="initial-state">',
  "    {scriptJSON(state)}",
  "  </script>",
  ");",
].join("\n");

export const RAW_TEXT_CODE = [
  "return (",
  "  <>",
  '    <script type="application/json">',
  "      {scriptJSON(data)}",
  "    </script>",
  "    <style>{unsafeHTML(trustedStylesheet)}</style>",
  "  </>",
  ");",
].join("\n");

export const WARNING_CODE = [
  "const body = await renderToString(view, {",
  "  onWarning(warning) {",
  "    console.warn(warning.message);",
  "  },",
  "});",
].join("\n");
