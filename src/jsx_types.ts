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

/** Attributes shared by HTML elements. Event handlers are intentionally absent. */
export interface HTMLAttributes extends DataAttributes, AriaAttributes {
  children?: Renderable;
  accesskey?: string;
  autocapitalize?: string;
  autofocus?: boolean;
  class?: string;
  contenteditable?: Booleanish | "inherit" | "plaintext-only";
  dir?: "ltr" | "rtl" | "auto";
  draggable?: Booleanish;
  enterkeyhint?: string;
  hidden?: boolean | "until-found";
  id?: string;
  inert?: boolean;
  inputmode?: string;
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
}

export interface AnchorHTMLAttributes extends HTMLAttributes {
  download?: string | boolean;
  href?: string;
  hreflang?: string;
  ping?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  target?: "_blank" | "_parent" | "_self" | "_top" | string;
  type?: string;
}

export interface AreaHTMLAttributes extends HTMLAttributes {
  alt?: string;
  coords?: string;
  download?: string | boolean;
  href?: string;
  ping?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  shape?: "default" | "rect" | "circle" | "poly";
  target?: string;
}

export interface AudioHTMLAttributes extends MediaHTMLAttributes {
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto" | "";
}

export interface BaseHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: string;
}

export interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string;
}

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

export interface CanvasHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  width?: number | string;
}

export interface ColHTMLAttributes extends HTMLAttributes {
  span?: number;
}

export interface DataHTMLAttributes extends HTMLAttributes {
  value?: string | number;
}

export interface DelHTMLAttributes extends HTMLAttributes {
  cite?: string;
  datetime?: string;
}

export interface DetailsHTMLAttributes extends HTMLAttributes {
  name?: string;
  open?: boolean;
}

export interface DialogHTMLAttributes extends HTMLAttributes {
  closedby?: "any" | "closerequest" | "none";
  open?: boolean;
}

export interface EmbedHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  src?: string;
  type?: string;
  width?: number | string;
}

export interface FieldsetHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  form?: string;
  name?: string;
}

export interface FormHTMLAttributes extends HTMLAttributes {
  acceptcharset?: string;
  action?: string;
  autocomplete?: "on" | "off";
  enctype?: string;
  method?: "get" | "post" | "dialog";
  name?: string;
  novalidate?: boolean;
  rel?: string;
  target?: string;
}

export interface HtmlRootAttributes extends HTMLAttributes {
  xmlns?: string;
}

export interface IframeHTMLAttributes extends HTMLAttributes {
  allow?: string;
  allowfullscreen?: boolean;
  height?: number | string;
  loading?: "eager" | "lazy";
  name?: string;
  referrerpolicy?: ReferrerPolicy;
  sandbox?: string;
  src?: string;
  srcdoc?: string;
  width?: number | string;
}

export interface ImgHTMLAttributes extends HTMLAttributes {
  alt?: string;
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
  value?: string | number | readonly string[];
  width?: number | string;
}

export interface LabelHTMLAttributes extends HTMLAttributes {
  for?: string;
  form?: string;
}

export interface LiHTMLAttributes extends HTMLAttributes {
  value?: number;
}

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

export interface MapHTMLAttributes extends HTMLAttributes {
  name?: string;
}

export interface MediaHTMLAttributes extends HTMLAttributes {
  crossorigin?: CrossOrigin;
  src?: string;
}

export interface MenuHTMLAttributes extends HTMLAttributes {
  type?: string;
}

export interface MetaHTMLAttributes extends HTMLAttributes {
  charset?: string;
  content?: string;
  "http-equiv"?: string;
  media?: string;
  name?: string;
}

export interface MeterHTMLAttributes extends HTMLAttributes {
  high?: number;
  low?: number;
  max?: number;
  min?: number;
  optimum?: number;
  value?: number;
}

export interface ObjectHTMLAttributes extends HTMLAttributes {
  data?: string;
  form?: string;
  height?: number | string;
  name?: string;
  type?: string;
  usemap?: string;
  width?: number | string;
}

export interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean;
  start?: number;
  type?: "1" | "a" | "A" | "i" | "I";
}

export interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
}

export interface OptionHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: string | number;
}

export interface OutputHTMLAttributes extends HTMLAttributes {
  for?: string;
  form?: string;
  name?: string;
}

export interface ProgressHTMLAttributes extends HTMLAttributes {
  max?: number;
  value?: number;
}

export interface QuoteHTMLAttributes extends HTMLAttributes {
  cite?: string;
}

export interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean;
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

export interface SelectHTMLAttributes extends HTMLAttributes {
  autocomplete?: string;
  disabled?: boolean;
  form?: string;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  size?: number;
}

export interface SlotHTMLAttributes extends HTMLAttributes {
  name?: string;
}

export interface SourceHTMLAttributes extends HTMLAttributes {
  height?: number | string;
  media?: string;
  sizes?: string;
  src?: string;
  srcset?: string;
  type?: string;
  width?: number | string;
}

export interface StyleHTMLAttributes extends HTMLAttributes {
  blocking?: string;
  media?: string;
  title?: string;
}

export interface TableCellHTMLAttributes extends HTMLAttributes {
  colspan?: number;
  headers?: string;
  rowspan?: number;
  scope?: "row" | "col" | "rowgroup" | "colgroup";
}

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

export interface TimeHTMLAttributes extends HTMLAttributes {
  datetime?: string;
}

export interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  label?: string;
  src?: string;
  srclang?: string;
}

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

/** Shared inline SVG attributes using their native serialized spellings. */
export interface SVGAttributes extends DataAttributes, AriaAttributes {
  children?: Renderable;
  class?: string;
  color?: string;
  display?: string;
  fill?: string;
  "fill-opacity"?: number | string;
  "fill-rule"?: "nonzero" | "evenodd" | "inherit";
  filter?: string;
  height?: number | string;
  id?: string;
  lang?: string;
  "marker-end"?: string;
  "marker-mid"?: string;
  "marker-start"?: string;
  mask?: string;
  opacity?: number | string;
  "paint-order"?: string;
  "pointer-events"?: string;
  preserveAspectRatio?: string;
  role?: string;
  stroke?: string;
  "stroke-dasharray"?: string;
  "stroke-dashoffset"?: number | string;
  "stroke-linecap"?: "butt" | "round" | "square" | "inherit";
  "stroke-linejoin"?: "arcs" | "bevel" | "miter" | "miter-clip" | "round" |
    "inherit";
  "stroke-miterlimit"?: number | string;
  "stroke-opacity"?: number | string;
  "stroke-width"?: number | string;
  style?: string;
  tabindex?: number;
  transform?: string;
  "transform-origin"?: string;
  "vector-effect"?: string;
  viewBox?: string;
  visibility?: string;
  width?: number | string;
  x?: number | string;
  "xlink:href"?: string;
  xmlns?: string;
  "xmlns:xlink"?: string;
  y?: number | string;
}

export interface SVGGraphicsAttributes extends SVGAttributes {
  pathLength?: number | string;
}

export interface SVGCircleAttributes extends SVGGraphicsAttributes {
  cx?: number | string;
  cy?: number | string;
  r?: number | string;
}

export interface SVGEllipseAttributes extends SVGGraphicsAttributes {
  cx?: number | string;
  cy?: number | string;
  rx?: number | string;
  ry?: number | string;
}

export interface SVGLineAttributes extends SVGGraphicsAttributes {
  x1?: number | string;
  x2?: number | string;
  y1?: number | string;
  y2?: number | string;
}

export interface SVGPathAttributes extends SVGGraphicsAttributes {
  d?: string;
}

export interface SVGPointsAttributes extends SVGGraphicsAttributes {
  points?: string;
}

export interface SVGRectAttributes extends SVGGraphicsAttributes {
  rx?: number | string;
  ry?: number | string;
}

export interface SVGUseAttributes extends SVGGraphicsAttributes {
  href?: string;
}

/** Server-serializable attributes for hyphenated custom elements. */
export interface CustomElementAttributes extends HTMLAttributes {
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  open?: boolean;
  readonly?: boolean;
  selected?: boolean;
  value?: AttributeValue;
  [name: `${string}-${string}`]: AttributeValue;
}

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
  | "mask"
  | "marker"
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
  | "use";

type GeneralHTMLIntrinsicElements = {
  [Tag in GeneralHTMLTag]: HTMLAttributes;
};

type GeneralSVGIntrinsicElements = {
  [Tag in GeneralSVGTag]: SVGAttributes;
};

// JSX runtimes must expose this namespace for TypeScript's JSX type lookup.
// deno-lint-ignore no-namespace
export namespace JSX {
  export type Element = Html;
  export type ElementType =
    | keyof IntrinsicElements
    | ((props: never) => Renderable);

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export interface IntrinsicElements
    extends GeneralHTMLIntrinsicElements, GeneralSVGIntrinsicElements {
    [tagName: `${string}-${string}`]: CustomElementAttributes;
    a: AnchorHTMLAttributes;
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
    script: ScriptHTMLAttributes;
    select: SelectHTMLAttributes;
    slot: SlotHTMLAttributes;
    source: SourceHTMLAttributes;
    style: StyleHTMLAttributes;
    svg: SVGAttributes;
    circle: SVGCircleAttributes;
    ellipse: SVGEllipseAttributes;
    line: SVGLineAttributes;
    path: SVGPathAttributes;
    polygon: SVGPointsAttributes;
    polyline: SVGPointsAttributes;
    rect: SVGRectAttributes;
    use: SVGUseAttributes;
    td: TableCellHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    th: TableCellHTMLAttributes;
    time: TimeHTMLAttributes;
    track: TrackHTMLAttributes;
    video: VideoHTMLAttributes;
  }
}
