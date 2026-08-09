import type { Component } from "@bastianplsfix/html";
import {
  ApiPage,
  ConceptsPage,
  GettingStartedPage,
  HomePage,
  SecurityPage,
} from "../pages/mod.ts";

/** Metadata and component for one documentation route. */
export interface DocsRoute {
  readonly title: string;
  readonly description: string;
  readonly component: Component;
}

const ROUTES: ReadonlyMap<string, DocsRoute> = new Map([
  [
    "/",
    {
      title: "Overview",
      description:
        "Typed, server-only TSX templates for Deno with no virtual DOM, hydration, or client runtime.",
      component: HomePage,
    },
  ],
  [
    "/getting-started",
    {
      title: "Getting started",
      description:
        "Configure @bastianplsfix/html and render your first server-only TSX response with Deno.",
      component: GettingStartedPage,
    },
  ],
  [
    "/concepts",
    {
      title: "Core concepts",
      description:
        "Understand renderable values, deferred components, async traversal, and HTML-native attributes.",
      component: ConceptsPage,
    },
  ],
  [
    "/security",
    {
      title: "Security model",
      description:
        "Learn how @bastianplsfix/html handles text, attributes, trusted markup, embedded JSON, and URLs.",
      component: SecurityPage,
    },
  ],
  [
    "/api",
    {
      title: "API reference",
      description:
        "Reference for @bastianplsfix/html values, buffered and streaming renderers, options, and trust helpers.",
      component: ApiPage,
    },
  ],
]);

/** Look up an exact, canonical documentation path. */
export function findRoute(path: string): DocsRoute | undefined {
  return ROUTES.get(path);
}
