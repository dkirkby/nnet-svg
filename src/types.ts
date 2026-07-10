// Public type definitions (DESIGN_SPEC.md §12, §13, §25).

export type Orientation = "horizontal" | "vertical";

/** Internal SVG coordinate system used for layout, radii and font sizes. */
export type ViewBox = {
  width: number;
  height: number;
};

/**
 * SVG attributes as a plain object, e.g. `{ fill: "red", "stroke-width": 2 }`.
 * `null` and `undefined` values remove/skip the attribute.
 */
export type SvgAttrs = Record<string, string | number | boolean | null | undefined>;

/** Options accepted by {@link layoutDenseNetwork} (and included in the SVG options). */
export type DenseNetworkLayoutOptions = {
  /** Layer sizes, e.g. `[3, 8, 4, 1]`. Required; at least 2 positive integers. */
  layers: number[];
  /**
   * Layers larger than this are truncated around a central ellipsis.
   * Must be an even integer >= 2. Default: 12.
   */
  maxDisplayedNodes?: number;
  /** Direction of layer flow. Default: "horizontal" (left to right). */
  orientation?: Orientation;
  /**
   * Internal coordinate system. Defaults: 640x360 (horizontal), 360x640 (vertical).
   */
  viewBox?: ViewBox;
  /**
   * Controls edge insets of the node stack within a layer. Finite number >= -1;
   * -1 pins outer nodes to the edges, +1 makes edge insets equal inter-node gaps.
   * Default: 0.
   */
  nodeSpread?: number;
  /** Same as {@link DenseNetworkLayoutOptions.nodeSpread}, for layer placement. Default: 0. */
  layerSpread?: number;
  /** Node circle radius. Default: 1/8 of the smallest inter-node gap. */
  nodeRadius?: number;
  /** Radius of the three ellipsis dots. Default: nodeRadius / 4. */
  ellipsisDotRadius?: number;
};

/** Reference to a real node, using true original indices. */
export type NodeRef = {
  kind: "node";
  layerIndex: number;
  nodeIndex: number;
};

/** Reference to an edge, using true original node indices. */
export type EdgeRef = {
  kind: "edge";
  sourceLayerIndex: number;
  sourceNodeIndex: number;
  targetLayerIndex: number;
  targetNodeIndex: number;
  /** Global index across all edges in the network. */
  edgeIndex: number;
};

/** Datum passed to node styling/label/title callbacks. */
export type NodeDatum = NodeRef & {
  /** Cached result of the `nodeValue` callback, if it produced a number. */
  value?: number;
};

/** Datum passed to edge styling/label/title callbacks. */
export type EdgeDatum = EdgeRef & {
  /** Cached result of the `edgeValue` callback, if it produced a number. */
  value?: number;
};

/** Options accepted by {@link createDenseNetworkSvg} and {@link renderDenseNetworkSvg}. */
export type DenseNetworkSvgOptions = DenseNetworkLayoutOptions & {
  /**
   * When true (the default), the SVG scales to its container width;
   * when false, it gets fixed width/height attributes from the viewBox.
   */
  responsive?: boolean;
  /** Prefix for generated CSS classes. Default: "dn". */
  classPrefix?: string;
  /**
   * Prefix for generated SVG ids (title/desc). Generated uniquely if omitted;
   * if provided, the caller is responsible for uniqueness within the page.
   */
  idPrefix?: string;
  /**
   * When true, callback errors and invalid callback results throw;
   * when false (the default), they are logged via console.error and ignored.
   */
  strict?: boolean;

  /** Accessible title; rendered as a top-level SVG <title>. */
  title?: string;
  /** Accessible description; a summary is generated if omitted. */
  desc?: string;

  /** Extra attributes merged onto the root <svg> (viewBox cannot be overridden). */
  svgAttrs?: SvgAttrs;

  nodeValue?: (node: NodeRef) => number | null | undefined;
  edgeValue?: (edge: EdgeRef) => number | null | undefined;

  nodeAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
  edgeAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;

  nodeLabel?: (node: NodeDatum) => string | number | null | undefined;
  edgeLabel?: (edge: EdgeDatum) => string | number | null | undefined;

  nodeLabelAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
  edgeLabelAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;

  nodeTitle?: (node: NodeDatum) => string | null | undefined;
  edgeTitle?: (edge: EdgeDatum) => string | null | undefined;
};

/** A displayed real node with its resolved position. */
export type LayoutNodeItem = {
  kind: "node";
  layerIndex: number;
  /** True index in the original layer. */
  nodeIndex: number;
  /** Slot index within the visible layer. */
  visibleIndex: number;
  x: number;
  y: number;
};

/** An ellipsis glyph standing in for omitted nodes in a truncated layer. */
export type LayoutEllipsisItem = {
  kind: "ellipsis";
  layerIndex: number;
  /** Slot index within the visible layer. */
  visibleIndex: number;
  /** Number of real nodes hidden by this ellipsis. */
  omittedCount: number;
  x: number;
  y: number;
};

export type LayoutItem = LayoutNodeItem | LayoutEllipsisItem;

/** A straight edge between two displayed real nodes in adjacent layers. */
export type LayoutEdge = {
  sourceLayerIndex: number;
  /** True source node index. */
  sourceNodeIndex: number;
  targetLayerIndex: number;
  /** True target node index. */
  targetNodeIndex: number;
  /** Global index across all edges in the network. */
  edgeIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Result of {@link layoutDenseNetwork}: resolved geometry without any DOM. */
export type DenseNetworkLayout = {
  viewBox: ViewBox;
  orientation: Orientation;
  /** Ordered by layer index, then visible slot position within the layer. */
  items: LayoutItem[];
  /** Ordered by layer pair, then source visible order, then target visible order. */
  edges: LayoutEdge[];
  /** Resolved node circle radius (default or from options). */
  nodeRadius: number;
  /** Resolved ellipsis dot radius (default or from options). */
  ellipsisDotRadius: number;
};
