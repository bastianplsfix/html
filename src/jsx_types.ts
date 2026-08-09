import type { Html, Renderable } from "./model.ts";

/** Values accepted by ordinary HTML attributes. */
export type AttributeValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

type Booleanish = boolean | "true" | "false";
type CrossOrigin = "anonymous" | "use-credentials" | "";
type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

interface DataAttributes {
  [name: `data-${string}`]: AttributeValue;
}

interface AriaAttributes {
  [name: `aria-${string}`]: AttributeValue;
}

type HTMLInputMode =
  | "decimal"
  | "email"
  | "none"
  | "numeric"
  | "search"
  | "tel"
  | "text"
  | "url";

type HTMLEnterKeyHint =
  | "done"
  | "enter"
  | "go"
  | "next"
  | "previous"
  | "search"
  | "send";

/** Attributes shared by HTML elements. Event handlers are intentionally absent. */
export interface HTMLAttributes extends DataAttributes, AriaAttributes {
  children?: Renderable;
  accesskey?: string;
  autocapitalize?: "characters" | "none" | "off" | "on" | "sentences" | "words";
  autocorrect?: "off" | "on";
  autofocus?: boolean;
  class?: string;
  contenteditable?: Booleanish | "inherit" | "plaintext-only";
  dir?: "ltr" | "rtl" | "auto";
  draggable?: Booleanish;
  enterkeyhint?: HTMLEnterKeyHint;
  exportparts?: string;
  hidden?: boolean | "until-found";
  id?: string;
  inert?: boolean;
  inputmode?: HTMLInputMode;
  is?: string;
  itemid?: string;
  itemprop?: string;
  itemref?: string;
  itemscope?: boolean;
  itemtype?: string;
  lang?: string;
  nonce?: string;
  part?: string;
  popover?: "auto" | "hint" | "manual" | "";
  role?: string;
  slot?: string;
  spellcheck?: Booleanish;
  style?: string;
  tabindex?: number;
  title?: string;
  translate?: "yes" | "no";
  virtualkeyboardpolicy?: "auto" | "manual";
  writingsuggestions?: Booleanish;
}

/** Attributes for the HTML `a` element. */
export interface AnchorHTMLAttributes extends HTMLAttributes {
  attributionsrc?: string;
  download?: string | boolean;
  href?: string;
  hreflang?: string;
  ping?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  target?: "_blank" | "_parent" | "_self" | "_top" | string;
  type?: string;
}

/** Attributes for the HTML `area` element. */
export interface AreaHTMLAttributes extends HTMLAttributes {
  alt?: string;
  attributionsrc?: string;
  coords?: string;
  download?: string | boolean;
  href?: string;
  ping?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  shape?: "default" | "rect" | "circle" | "poly";
  target?: string;
}

/** Attributes for the HTML `audio` element. */
export interface AudioHTMLAttributes extends MediaHTMLAttributes {
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto" | "";
}

/** Attributes for the HTML `base` element. */
export interface BaseHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: string;
}

/** Attributes for HTML quotation elements. */
export interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string;
}

/** Attributes for the HTML `button` element. */
export interface ButtonHTMLAttributes extends HTMLAttributes {
  command?: string;
  commandfor?: string;
  disabled?: boolean;
  form?: string;
  formaction?: string;
  formenctype?: string;
  formmethod?: "get" | "post" | "dialog";
  formnovalidate?: boolean;
  formtarget?: string;
  name?: string;
  popovertarget?: string;
  popovertargetaction?: "hide" | "show" | "toggle";
  type?: "button" | "reset" | "submit";
  value?: string | number;
}

/** Attributes for the HTML `canvas` element. */
export interface CanvasHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  width?: number | string;
}

/** Attributes for HTML table-column elements. */
export interface ColHTMLAttributes extends HTMLAttributes {
  span?: number;
}

/** Attributes for the HTML `data` element. */
export interface DataHTMLAttributes extends HTMLAttributes {
  value?: string | number;
}

/** Attributes for HTML modification elements. */
export interface DelHTMLAttributes extends HTMLAttributes {
  cite?: string;
  datetime?: string;
}

/** Attributes for the HTML `details` element. */
export interface DetailsHTMLAttributes extends HTMLAttributes {
  name?: string;
  open?: boolean;
}

/** Attributes for the HTML `dialog` element. */
export interface DialogHTMLAttributes extends HTMLAttributes {
  closedby?: "any" | "closerequest" | "none";
  open?: boolean;
}

/** Attributes for the HTML `embed` element. */
export interface EmbedHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  src?: string;
  type?: string;
  width?: number | string;
}

/** Attributes for the HTML `fieldset` element. */
export interface FieldsetHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  form?: string;
  name?: string;
}

/** Attributes for the HTML `form` element. */
export interface FormHTMLAttributes extends HTMLAttributes {
  "accept-charset"?: string;
  action?: string;
  autocomplete?: "on" | "off";
  enctype?: string;
  method?: "get" | "post" | "dialog";
  name?: string;
  novalidate?: boolean;
  rel?: string;
  target?: string;
}

/** Attributes for the root HTML element. */
export interface HtmlRootAttributes extends HTMLAttributes {
  xmlns?: string;
}

/** Attributes for the HTML `iframe` element. */
export interface IframeHTMLAttributes extends HTMLAttributes {
  allow?: string;
  allowfullscreen?: boolean;
  credentialless?: boolean;
  height?: number | string;
  loading?: "eager" | "lazy";
  name?: string;
  referrerpolicy?: ReferrerPolicy;
  sandbox?: string;
  src?: string;
  width?: number | string;
}

/** Attributes for the HTML `img` element. */
export interface ImgHTMLAttributes extends HTMLAttributes {
  alt?: string;
  attributionsrc?: string;
  crossorigin?: CrossOrigin;
  decoding?: "async" | "auto" | "sync";
  fetchpriority?: "high" | "low" | "auto";
  height?: number | string;
  ismap?: boolean;
  loading?: "eager" | "lazy";
  referrerpolicy?: ReferrerPolicy;
  sizes?: string;
  src?: string;
  srcset?: string;
  usemap?: string;
  width?: number | string;
}

/** Attributes for the HTML `input` element. */
export interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string;
  alt?: string;
  autocomplete?: string;
  capture?: boolean | "user" | "environment";
  checked?: boolean;
  dirname?: string;
  disabled?: boolean;
  form?: string;
  formaction?: string;
  formenctype?: string;
  formmethod?: "get" | "post" | "dialog";
  formnovalidate?: boolean;
  formtarget?: string;
  height?: number | string;
  list?: string;
  max?: number | string;
  maxlength?: number;
  min?: number | string;
  minlength?: number;
  multiple?: boolean;
  name?: string;
  pattern?: string;
  placeholder?: string;
  popovertarget?: string;
  popovertargetaction?: "hide" | "show" | "toggle";
  readonly?: boolean;
  required?: boolean;
  size?: number;
  src?: string;
  step?: number | string;
  type?:
    | "button"
    | "checkbox"
    | "color"
    | "date"
    | "datetime-local"
    | "email"
    | "file"
    | "hidden"
    | "image"
    | "month"
    | "number"
    | "password"
    | "radio"
    | "range"
    | "reset"
    | "search"
    | "submit"
    | "tel"
    | "text"
    | "time"
    | "url"
    | "week";
  value?: string | number;
  width?: number | string;
}

/** Attributes for the HTML `label` element. */
export interface LabelHTMLAttributes extends HTMLAttributes {
  for?: string;
  form?: string;
}

/** Attributes for the HTML `li` element. */
export interface LiHTMLAttributes extends HTMLAttributes {
  value?: number;
}

/** Attributes for the HTML `link` element. */
export interface LinkHTMLAttributes extends HTMLAttributes {
  as?: string;
  blocking?: string;
  crossorigin?: CrossOrigin;
  disabled?: boolean;
  fetchpriority?: "high" | "low" | "auto";
  href?: string;
  hreflang?: string;
  imagesizes?: string;
  imagesrcset?: string;
  integrity?: string;
  media?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  sizes?: string;
  type?: string;
}

/** Attributes for the HTML `map` element. */
export interface MapHTMLAttributes extends HTMLAttributes {
  name?: string;
}

/** Attributes shared by HTML media elements. */
export interface MediaHTMLAttributes extends HTMLAttributes {
  autoplay?: boolean;
  controls?: boolean;
  controlslist?: string;
  crossorigin?: CrossOrigin;
  disableremoteplayback?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto" | "";
  src?: string;
}

/** Attributes for the HTML `menu` element. */
export interface MenuHTMLAttributes extends HTMLAttributes {
  type?: string;
}

/** Attributes for the HTML `meta` element. */
export interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: string;
  content?: string;
  "http-equiv"?: string;
  media?: string;
  name?: string;
}

/** Attributes for the HTML `meter` element. */
export interface MeterHTMLAttributes extends HTMLAttributes {
  high?: number;
  low?: number;
  max?: number;
  min?: number;
  optimum?: number;
  value?: number;
}

/** Attributes for the HTML `object` element. */
export interface ObjectHTMLAttributes extends HTMLAttributes {
  data?: string;
  form?: string;
  height?: number | string;
  name?: string;
  type?: string;
  usemap?: string;
  width?: number | string;
}

/** Attributes for the HTML `ol` element. */
export interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean;
  start?: number;
  type?: "1" | "a" | "A" | "i" | "I";
}

/** Attributes for the HTML `optgroup` element. */
export interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
}

/** Attributes for the HTML `option` element. */
export interface OptionHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: string | number;
}

/** Attributes for the HTML `output` element. */
export interface OutputHTMLAttributes extends HTMLAttributes {
  for?: string;
  form?: string;
  name?: string;
}

/** Attributes for the HTML `progress` element. */
export interface ProgressHTMLAttributes extends HTMLAttributes {
  max?: number;
  value?: number;
}

/** Attributes for the HTML `q` element. */
export interface QuoteHTMLAttributes extends HTMLAttributes {
  cite?: string;
}

/** Attributes for the HTML `script` element. */
export interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean;
  attributionsrc?: string;
  blocking?: string;
  crossorigin?: CrossOrigin;
  defer?: boolean;
  fetchpriority?: "high" | "low" | "auto";
  integrity?: string;
  nomodule?: boolean;
  referrerpolicy?: ReferrerPolicy;
  src?: string;
  type?: string;
}

/** Attributes for the HTML `select` element. */
export interface SelectHTMLAttributes extends HTMLAttributes {
  autocomplete?: string;
  disabled?: boolean;
  form?: string;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  size?: number;
}

/** Attributes for the HTML `slot` element. */
export interface SlotHTMLAttributes extends HTMLAttributes {
  name?: string;
}

/** Attributes for the HTML `source` element. */
export interface SourceHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  media?: string;
  sizes?: string;
  src?: string;
  srcset?: string;
  type?: string;
  width?: number | string;
}

/** Attributes for the HTML `style` element. */
export interface StyleHTMLAttributes extends HTMLAttributes {
  blocking?: string;
  media?: string;
  title?: string;
}

/** Attributes shared by HTML table-cell elements. */
export interface TableCellHTMLAttributes extends HTMLAttributes {
  colspan?: number;
  headers?: string;
  rowspan?: number;
  scope?: "row" | "col" | "rowgroup" | "colgroup";
}

/** Attributes for the HTML `textarea` element. */
export interface TextareaHTMLAttributes extends HTMLAttributes {
  autocomplete?: string;
  cols?: number;
  dirname?: string;
  disabled?: boolean;
  form?: string;
  maxlength?: number;
  minlength?: number;
  name?: string;
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  rows?: number;
  wrap?: "hard" | "soft";
}

/** Attributes for the HTML `time` element. */
export interface TimeHTMLAttributes extends HTMLAttributes {
  datetime?: string;
}

/** Attributes for the HTML `track` element. */
export interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  label?: string;
  src?: string;
  srclang?: string;
}

/** Attributes for the HTML `video` element. */
export interface VideoHTMLAttributes extends MediaHTMLAttributes {
  autoplay?: boolean;
  controls?: boolean;
  height?: number | string;
  loop?: boolean;
  muted?: boolean;
  playsinline?: boolean;
  poster?: string;
  preload?: "none" | "metadata" | "auto" | "";
  width?: number | string;
}

type SVGNumber = number | string;

/**
 * SVG attributes using their serialized, case-sensitive names.
 *
 * Event handlers and React-style aliases are intentionally absent.
 */
export interface SVGAttributes extends DataAttributes, AriaAttributes {
  accumulate?: "none" | "sum";
  additive?: "replace" | "sum";
  "alignment-baseline"?: string;
  amplitude?: SVGNumber;
  attributeName?: string;
  attributeType?: string;
  autoReverse?: Booleanish;
  azimuth?: SVGNumber;
  baseFrequency?: SVGNumber;
  "baseline-shift"?: SVGNumber;
  begin?: SVGNumber;
  bias?: SVGNumber;
  by?: SVGNumber;
  calcMode?: "discrete" | "linear" | "paced" | "spline";
  children?: Renderable;
  class?: string;
  clip?: SVGNumber;
  "clip-path"?: string;
  "clip-rule"?: "evenodd" | "inherit" | "nonzero";
  clipPathUnits?: "objectBoundingBox" | "userSpaceOnUse";
  color?: string;
  "color-interpolation"?: string;
  "color-interpolation-filters"?: "auto" | "linearRGB" | "sRGB";
  "color-rendering"?: string;
  crossorigin?: CrossOrigin;
  cursor?: string;
  cx?: SVGNumber;
  cy?: SVGNumber;
  d?: string;
  decelerate?: SVGNumber;
  diffuseConstant?: SVGNumber;
  direction?: "ltr" | "rtl";
  display?: string;
  divisor?: SVGNumber;
  "dominant-baseline"?: string;
  dur?: SVGNumber;
  dx?: SVGNumber;
  dy?: SVGNumber;
  edgeMode?: "duplicate" | "none" | "wrap";
  elevation?: SVGNumber;
  end?: SVGNumber;
  exponent?: SVGNumber;
  externalResourcesRequired?: Booleanish;
  fetchpriority?: "auto" | "high" | "low";
  fill?: string;
  "fill-opacity"?: SVGNumber;
  "fill-rule"?: "evenodd" | "inherit" | "nonzero";
  filter?: string;
  filterRes?: SVGNumber;
  filterUnits?: "objectBoundingBox" | "userSpaceOnUse";
  "flood-color"?: string;
  "flood-opacity"?: SVGNumber;
  focusable?: Booleanish | "auto";
  "font-family"?: string;
  "font-size"?: SVGNumber;
  "font-size-adjust"?: SVGNumber;
  "font-stretch"?: string;
  "font-style"?: string;
  "font-variant"?: string;
  "font-weight"?: SVGNumber;
  fr?: SVGNumber;
  from?: SVGNumber;
  fx?: SVGNumber;
  fy?: SVGNumber;
  gradientTransform?: string;
  gradientUnits?: "objectBoundingBox" | "userSpaceOnUse";
  height?: number | string;
  href?: string;
  id?: string;
  "image-rendering"?: string;
  in?: string;
  in2?: string;
  intercept?: SVGNumber;
  k?: SVGNumber;
  k1?: SVGNumber;
  k2?: SVGNumber;
  k3?: SVGNumber;
  k4?: SVGNumber;
  kernelMatrix?: string;
  kernelUnitLength?: SVGNumber;
  keyPoints?: string;
  keySplines?: string;
  keyTimes?: string;
  lang?: string;
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  "letter-spacing"?: SVGNumber;
  "lighting-color"?: string;
  limitingConeAngle?: SVGNumber;
  "marker-end"?: string;
  markerHeight?: SVGNumber;
  "marker-mid"?: string;
  "marker-start"?: string;
  markerUnits?: "strokeWidth" | "userSpaceOnUse";
  markerWidth?: SVGNumber;
  mask?: string;
  maskContentUnits?: "objectBoundingBox" | "userSpaceOnUse";
  maskUnits?: "objectBoundingBox" | "userSpaceOnUse";
  max?: SVGNumber;
  media?: string;
  method?: string;
  min?: SVGNumber;
  mode?: string;
  name?: string;
  nonce?: string;
  numOctaves?: SVGNumber;
  offset?: SVGNumber;
  opacity?: SVGNumber;
  operator?: string;
  order?: SVGNumber;
  orient?: SVGNumber | "auto" | "auto-start-reverse";
  origin?: SVGNumber;
  overflow?: string;
  "paint-order"?: string;
  part?: string;
  path?: string;
  pathLength?: SVGNumber;
  patternContentUnits?: "objectBoundingBox" | "userSpaceOnUse";
  patternTransform?: string;
  patternUnits?: "objectBoundingBox" | "userSpaceOnUse";
  "pointer-events"?: string;
  points?: string;
  pointsAtX?: SVGNumber;
  pointsAtY?: SVGNumber;
  pointsAtZ?: SVGNumber;
  preserveAlpha?: Booleanish;
  preserveAspectRatio?: string;
  primitiveUnits?: "objectBoundingBox" | "userSpaceOnUse";
  r?: SVGNumber;
  radius?: SVGNumber;
  referrerpolicy?: ReferrerPolicy;
  refX?: SVGNumber;
  refY?: SVGNumber;
  repeatCount?: SVGNumber | "indefinite";
  repeatDur?: SVGNumber | "indefinite";
  requiredExtensions?: string;
  restart?: "always" | "never" | "whenNotActive";
  result?: string;
  role?: string;
  rotate?: SVGNumber;
  rx?: SVGNumber;
  ry?: SVGNumber;
  scale?: SVGNumber;
  seed?: SVGNumber;
  "shape-rendering"?: string;
  slope?: SVGNumber;
  spacing?: "auto" | "exact";
  specularConstant?: SVGNumber;
  specularExponent?: SVGNumber;
  spreadMethod?: "pad" | "reflect" | "repeat";
  startOffset?: SVGNumber;
  stdDeviation?: SVGNumber;
  stitchTiles?: "noStitch" | "stitch";
  "stop-color"?: string;
  "stop-opacity"?: SVGNumber;
  stroke?: string;
  "stroke-dasharray"?: SVGNumber;
  "stroke-dashoffset"?: SVGNumber;
  "stroke-linecap"?: "butt" | "inherit" | "round" | "square";
  "stroke-linejoin"?: "bevel" | "inherit" | "miter" | "round";
  "stroke-miterlimit"?: SVGNumber;
  "stroke-opacity"?: SVGNumber;
  "stroke-width"?: SVGNumber;
  style?: string;
  surfaceScale?: SVGNumber;
  systemLanguage?: string;
  tableValues?: string;
  tabindex?: number;
  target?: string;
  targetX?: SVGNumber;
  targetY?: SVGNumber;
  "text-anchor"?: "end" | "inherit" | "middle" | "start";
  "text-decoration"?: string;
  textLength?: SVGNumber;
  "text-rendering"?: string;
  to?: SVGNumber;
  transform?: string;
  "transform-origin"?: string;
  type?: string;
  "unicode-bidi"?: string;
  values?: string;
  "vector-effect"?: string;
  version?: string;
  viewBox?: string;
  viewTarget?: string;
  visibility?: string;
  width?: number | string;
  "word-spacing"?: SVGNumber;
  "writing-mode"?: string;
  x?: number | string;
  x1?: SVGNumber;
  x2?: SVGNumber;
  xChannelSelector?: "A" | "B" | "G" | "R";
  "xlink:actuate"?: string;
  "xlink:arcrole"?: string;
  "xlink:href"?: string;
  "xlink:role"?: string;
  "xlink:show"?: string;
  "xlink:title"?: string;
  "xlink:type"?: string;
  "xml:base"?: string;
  "xml:lang"?: string;
  "xml:space"?: "default" | "preserve";
  xmlns?: string;
  "xmlns:xlink"?: string;
  y?: number | string;
  y1?: SVGNumber;
  y2?: SVGNumber;
  yChannelSelector?: "A" | "B" | "G" | "R";
  z?: SVGNumber;
  zoomAndPan?: "disable" | "magnify";
}

/** Serializable props accepted by hyphenated custom-element names. */
export interface CustomElementAttributes extends HTMLAttributes {
  [name: `${string}-${string}`]: AttributeValue;
}

// Checked snapshots of the non-specialized names in TypeScript's DOM tag maps.
// Keeping the names local avoids forcing DOM globals into server consumers and
// complies with JSR's ban on global-modifying triple-slash directives.
type GeneralHTMLTag =
  | "abbr"
  | "address"
  | "article"
  | "aside"
  | "b"
  | "bdi"
  | "bdo"
  | "body"
  | "br"
  | "caption"
  | "cite"
  | "code"
  | "datalist"
  | "dd"
  | "dfn"
  | "div"
  | "dl"
  | "dt"
  | "em"
  | "figcaption"
  | "figure"
  | "footer"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "head"
  | "header"
  | "hgroup"
  | "hr"
  | "i"
  | "kbd"
  | "legend"
  | "main"
  | "mark"
  | "nav"
  | "noscript"
  | "p"
  | "picture"
  | "pre"
  | "rp"
  | "rt"
  | "ruby"
  | "s"
  | "samp"
  | "search"
  | "section"
  | "small"
  | "span"
  | "strong"
  | "sub"
  | "summary"
  | "sup"
  | "table"
  | "tbody"
  | "template"
  | "tfoot"
  | "thead"
  | "title"
  | "tr"
  | "u"
  | "ul"
  | "var"
  | "wbr";

type GeneralSVGTag =
  | "animate"
  | "animateMotion"
  | "animateTransform"
  | "circle"
  | "clipPath"
  | "defs"
  | "desc"
  | "ellipse"
  | "feBlend"
  | "feColorMatrix"
  | "feComponentTransfer"
  | "feComposite"
  | "feConvolveMatrix"
  | "feDiffuseLighting"
  | "feDisplacementMap"
  | "feDistantLight"
  | "feDropShadow"
  | "feFlood"
  | "feFuncA"
  | "feFuncB"
  | "feFuncG"
  | "feFuncR"
  | "feGaussianBlur"
  | "feImage"
  | "feMerge"
  | "feMergeNode"
  | "feMorphology"
  | "feOffset"
  | "fePointLight"
  | "feSpecularLighting"
  | "feSpotLight"
  | "feTile"
  | "feTurbulence"
  | "filter"
  | "foreignObject"
  | "g"
  | "image"
  | "line"
  | "linearGradient"
  | "marker"
  | "mask"
  | "metadata"
  | "mpath"
  | "path"
  | "pattern"
  | "polygon"
  | "polyline"
  | "radialGradient"
  | "rect"
  | "set"
  | "stop"
  | "switch"
  | "symbol"
  | "text"
  | "textPath"
  | "tspan"
  | "use"
  | "view";

type GeneralHTMLIntrinsicElements = {
  [Tag in GeneralHTMLTag]: HTMLAttributes;
};

type GeneralSVGIntrinsicElements = {
  [Tag in GeneralSVGTag]: SVGAttributes;
};

/** Types consumed by TypeScript's automatic JSX transform. */
// deno-lint-ignore no-namespace
export namespace JSX {
  /** The immutable instruction value produced by a JSX expression. */
  export type Element = Html;

  /** Intrinsic names and server component functions accepted in JSX. */
  export type ElementType =
    | keyof IntrinsicElements
    | ((props: never) => Renderable);

  /** Identifies the component prop that receives nested JSX children. */
  export interface ElementChildrenAttribute {
    /** Property used by the transform for nested JSX children. */
    children: unknown;
  }

  /** HTML, SVG, and custom elements supported by the JSX runtime. */
  export interface IntrinsicElements
    extends GeneralHTMLIntrinsicElements, GeneralSVGIntrinsicElements {
    [tagName: `${string}-${string}`]: CustomElementAttributes;
    // JSX cannot choose attribute types from the parent namespace. Names shared
    // by HTML and SVG therefore accept the attributes of both elements.
    a: AnchorHTMLAttributes & SVGAttributes;
    area: AreaHTMLAttributes;
    audio: AudioHTMLAttributes;
    base: BaseHTMLAttributes;
    blockquote: BlockquoteHTMLAttributes;
    button: ButtonHTMLAttributes;
    canvas: CanvasHTMLAttributes;
    col: ColHTMLAttributes;
    colgroup: ColHTMLAttributes;
    data: DataHTMLAttributes;
    del: DelHTMLAttributes;
    details: DetailsHTMLAttributes;
    dialog: DialogHTMLAttributes;
    embed: EmbedHTMLAttributes;
    fieldset: FieldsetHTMLAttributes;
    form: FormHTMLAttributes;
    html: HtmlRootAttributes;
    iframe: IframeHTMLAttributes;
    img: ImgHTMLAttributes;
    input: InputHTMLAttributes;
    ins: DelHTMLAttributes;
    label: LabelHTMLAttributes;
    li: LiHTMLAttributes;
    link: LinkHTMLAttributes;
    map: MapHTMLAttributes;
    menu: MenuHTMLAttributes;
    meta: MetaHTMLAttributes;
    meter: MeterHTMLAttributes;
    object: ObjectHTMLAttributes;
    ol: OlHTMLAttributes;
    optgroup: OptgroupHTMLAttributes;
    option: OptionHTMLAttributes;
    output: OutputHTMLAttributes;
    progress: ProgressHTMLAttributes;
    q: QuoteHTMLAttributes;
    script: ScriptHTMLAttributes & SVGAttributes;
    select: SelectHTMLAttributes;
    slot: SlotHTMLAttributes;
    source: SourceHTMLAttributes;
    style: StyleHTMLAttributes & SVGAttributes;
    svg: SVGAttributes;
    td: TableCellHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    th: TableCellHTMLAttributes;
    time: TimeHTMLAttributes;
    title: HTMLAttributes & SVGAttributes;
    track: TrackHTMLAttributes;
    video: VideoHTMLAttributes;
  }
}
