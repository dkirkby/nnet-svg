// SVG rendering (DESIGN_SPEC.md §3, §7, §10–§17, §19, §21–§24).

import { create } from "d3-selection";
import type { Selection } from "d3-selection";
import { layoutDenseNetwork } from "./layout.js";
import { validateSvgOptions } from "./validate.js";
import type {
  DenseNetworkSvgOptions,
  EdgeDatum,
  EdgeRef,
  LayoutEdge,
  LayoutNodeItem,
  NodeDatum,
  NodeRef,
  SvgAttrs,
} from "./types.js";

// Default styling (spec §15): neutral and legible, overridable per element.
// The node stroke-width is resolved by the layout (spec §8), not fixed here.
const NODE_DEFAULT_ATTRS: SvgAttrs = {
  fill: "white",
  stroke: "currentColor",
};

const EDGE_DEFAULT_ATTRS: SvgAttrs = {
  stroke: "currentColor",
  "stroke-opacity": 0.25,
  "stroke-width": 1,
};

const ELLIPSIS_DOT_DEFAULT_ATTRS: SvgAttrs = {
  fill: "currentColor",
};

const LABEL_DEFAULT_ATTRS: SvgAttrs = {
  fill: "currentColor",
  "font-size": 10,
  "text-anchor": "middle",
  "dominant-baseline": "middle",
  "pointer-events": "none",
};

// Dot offsets from the slot center in units of the dot radius, so the glyph
// spans roughly one node diameter (spec §10 fixes only the central dot).
const ELLIPSIS_DOT_OFFSETS = [-3, 0, 3];

/**
 * Merges override attributes onto defaults (spec §15/§23): overrides win,
 * except `class`, where the override is appended to the generated class.
 */
function mergeAttrs(defaults: SvgAttrs, overrides: SvgAttrs | null | undefined): SvgAttrs {
  const merged: SvgAttrs = { ...defaults, ...overrides };
  if (defaults.class != null) {
    merged.class =
      overrides?.class != null ? `${defaults.class} ${overrides.class}` : defaults.class;
  }
  return merged;
}

/** Applies attributes to a selection, skipping null/undefined values. */
function setAttrs<GElement extends Element, Datum, PElement extends Element | null, PDatum>(
  selection: Selection<GElement, Datum, PElement, PDatum>,
  attrs: SvgAttrs,
): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) {
      selection.attr(name, String(value));
    }
  }
}

/**
 * Wraps user callbacks (spec §24): in strict mode exceptions propagate;
 * otherwise they are logged via console.error and treated as no result.
 * Calling with an undefined callback is a no-op returning undefined.
 */
function makeSafeCall(strict: boolean) {
  return function safeCall<Arg, Result>(
    name: string,
    callback: ((arg: Arg) => Result) | undefined,
    arg: Arg,
  ): Result | undefined {
    if (!callback) return undefined;
    try {
      return callback(arg);
    } catch (error) {
      if (strict) throw error;
      console.error(`nnet-svg: ${name} callback threw; treating its result as absent.`, error);
      return undefined;
    }
  };
}

/** Applies the value rules of spec §14 to a raw nodeValue/edgeValue result. */
function coerceValue(name: string, raw: unknown, strict: boolean): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return raw; // NaN and ±Infinity are preserved
  const message = `nnet-svg: ${name} must return a number, null, or undefined; received ${typeof raw}`;
  if (strict) throw new Error(message);
  console.error(message);
  return undefined;
}

const nodeKey = (layerIndex: number, nodeIndex: number) => `${layerIndex}:${nodeIndex}`;

/**
 * Creates and returns a new `SVGSVGElement` displaying the network.
 * This is the primary public API (spec §3.1).
 */
export function createDenseNetworkSvg(options: DenseNetworkSvgOptions): SVGSVGElement {
  validateSvgOptions(options);
  const layout = layoutDenseNetwork(options);

  const strict = options.strict ?? false;
  const safeCall = makeSafeCall(strict);
  const classPrefix = options.classPrefix ?? "dn";
  const cls = (name: string) => `${classPrefix}-${name}`;
  const responsive = options.responsive ?? true;
  const { width, height } = layout.viewBox;
  const horizontal = layout.orientation === "horizontal";

  const nodeItems = layout.items.filter(
    (item): item is LayoutNodeItem => item.kind === "node",
  );

  // ---- Value pass (spec §14): nodeValue/edgeValue run exactly once per
  // visible node/edge; results are cached and reused by all later callbacks.
  const nodeValues = new Map<string, number>();
  if (options.nodeValue) {
    for (const item of nodeItems) {
      const ref: NodeRef = {
        kind: "node",
        layerIndex: item.layerIndex,
        nodeIndex: item.nodeIndex,
      };
      const value = coerceValue("nodeValue", safeCall("nodeValue", options.nodeValue, ref), strict);
      if (value !== undefined) nodeValues.set(nodeKey(item.layerIndex, item.nodeIndex), value);
    }
  }
  const edgeValues = new Map<number, number>();
  if (options.edgeValue) {
    for (const edge of layout.edges) {
      const ref: EdgeRef = {
        kind: "edge",
        sourceLayerIndex: edge.sourceLayerIndex,
        sourceNodeIndex: edge.sourceNodeIndex,
        targetLayerIndex: edge.targetLayerIndex,
        targetNodeIndex: edge.targetNodeIndex,
        edgeIndex: edge.edgeIndex,
      };
      const value = coerceValue("edgeValue", safeCall("edgeValue", options.edgeValue, ref), strict);
      if (value !== undefined) edgeValues.set(edge.edgeIndex, value);
    }
  }

  // Semantic datum objects passed to styling/label/title callbacks (spec §13):
  // true indices plus the cached value, never layout geometry.
  const nodeDatums = new Map<string, NodeDatum>();
  for (const item of nodeItems) {
    const datum: NodeDatum = {
      kind: "node",
      layerIndex: item.layerIndex,
      nodeIndex: item.nodeIndex,
    };
    const value = nodeValues.get(nodeKey(item.layerIndex, item.nodeIndex));
    if (value !== undefined) datum.value = value;
    nodeDatums.set(nodeKey(item.layerIndex, item.nodeIndex), datum);
  }
  const edgeDatums = layout.edges.map((edge) => {
    const datum: EdgeDatum = {
      kind: "edge",
      sourceLayerIndex: edge.sourceLayerIndex,
      sourceNodeIndex: edge.sourceNodeIndex,
      targetLayerIndex: edge.targetLayerIndex,
      targetNodeIndex: edge.targetNodeIndex,
      edgeIndex: edge.edgeIndex,
    };
    const value = edgeValues.get(edge.edgeIndex);
    if (value !== undefined) datum.value = value;
    return datum;
  });
  const datumOfEdge = (edge: LayoutEdge): EdgeDatum => edgeDatums[edge.edgeIndex];
  const datumOfNode = (item: LayoutNodeItem): NodeDatum =>
    nodeDatums.get(nodeKey(item.layerIndex, item.nodeIndex))!;

  // ---- Root <svg> (spec §7.2, §23): defaults, then responsive attrs, then
  // user svgAttrs. svgAttrs.viewBox is ignored: the viewBox is controlled
  // exclusively by options.viewBox.
  const { viewBox: _unsupported, ...userSvgAttrs } = options.svgAttrs ?? {};
  const responsiveAttrs: SvgAttrs = responsive
    ? { width: "100%", style: "max-width: 100%; height: auto;" }
    : { width, height };
  const rootAttrs = mergeAttrs(
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "xMidYMid meet",
      class: cls("root"),
      ...responsiveAttrs,
    },
    userSvgAttrs,
  );

  const svg = create("svg");
  setAttrs(svg, rootAttrs);

  // Drawing order (spec §22): edges behind nodes/ellipses, labels on top.
  const edgesGroup = svg.append("g").attr("class", cls("edges"));
  const itemsGroup = svg.append("g").attr("class", cls("items"));
  const labelsGroup = svg.append("g").attr("class", cls("labels"));

  // ---- Edges (spec §11, §21.3).
  for (const edge of layout.edges) {
    const datum = datumOfEdge(edge);
    const line = edgesGroup
      .append("line")
      .attr("data-kind", "edge")
      .attr("data-source-layer-index", edge.sourceLayerIndex)
      .attr("data-source-node-index", edge.sourceNodeIndex)
      .attr("data-target-layer-index", edge.targetLayerIndex)
      .attr("data-target-node-index", edge.targetNodeIndex)
      .attr("data-edge-index", edge.edgeIndex)
      .attr("x1", edge.x1)
      .attr("y1", edge.y1)
      .attr("x2", edge.x2)
      .attr("y2", edge.y2);
    const userAttrs = safeCall("edgeAttrs", options.edgeAttrs, datum);
    setAttrs(line, mergeAttrs({ ...EDGE_DEFAULT_ATTRS, class: cls("edge") }, userAttrs));
    const title = safeCall("edgeTitle", options.edgeTitle, datum);
    if (title !== null && title !== undefined) line.append("title").text(String(title));
  }

  // ---- Nodes and ellipsis glyphs (spec §10, §21.1, §21.2).
  for (const item of layout.items) {
    if (item.kind === "node") {
      const datum = datumOfNode(item);
      const circle = itemsGroup
        .append("circle")
        .attr("data-kind", "node")
        .attr("data-layer-index", item.layerIndex)
        .attr("data-node-index", item.nodeIndex)
        .attr("cx", item.x)
        .attr("cy", item.y)
        .attr("r", layout.nodeRadius);
      const userAttrs = safeCall("nodeAttrs", options.nodeAttrs, datum);
      setAttrs(
        circle,
        mergeAttrs(
          {
            ...NODE_DEFAULT_ATTRS,
            "stroke-width": layout.nodeStrokeWidth,
            class: cls("node"),
          },
          userAttrs,
        ),
      );
      const title = safeCall("nodeTitle", options.nodeTitle, datum);
      if (title !== null && title !== undefined) circle.append("title").text(String(title));
    } else {
      const glyph = itemsGroup
        .append("g")
        .attr("class", cls("ellipsis"))
        .attr("data-kind", "ellipsis")
        .attr("data-layer-index", item.layerIndex)
        .attr("data-omitted-count", item.omittedCount);
      // Dots stack along the node-stack direction (spec §10): vertically for
      // horizontal networks, horizontally for vertical networks.
      for (const step of ELLIPSIS_DOT_OFFSETS) {
        const offset = step * layout.ellipsisDotRadius;
        const dot = glyph
          .append("circle")
          .attr("cx", horizontal ? item.x : item.x + offset)
          .attr("cy", horizontal ? item.y + offset : item.y)
          .attr("r", layout.ellipsisDotRadius);
        setAttrs(dot, { ...ELLIPSIS_DOT_DEFAULT_ATTRS, class: cls("ellipsis-dot") });
      }
    }
  }

  // ---- Labels (spec §16): positioned by the renderer, drawn above all
  // other elements. Label attr callbacks run only when a label is rendered.
  for (const edge of layout.edges) {
    const datum = datumOfEdge(edge);
    const raw = safeCall("edgeLabel", options.edgeLabel, datum);
    if (raw === null || raw === undefined) continue;
    const text = labelsGroup.append("text").attr("data-edge-index", edge.edgeIndex);
    const userAttrs = safeCall("edgeLabelAttrs", options.edgeLabelAttrs, datum);
    setAttrs(
      text,
      mergeAttrs(
        {
          ...LABEL_DEFAULT_ATTRS,
          x: (edge.x1 + edge.x2) / 2,
          y: (edge.y1 + edge.y2) / 2,
          class: cls("edge-label"),
        },
        userAttrs,
      ),
    );
    text.text(String(raw));
  }
  for (const item of nodeItems) {
    const datum = datumOfNode(item);
    const raw = safeCall("nodeLabel", options.nodeLabel, datum);
    if (raw === null || raw === undefined) continue;
    const text = labelsGroup
      .append("text")
      .attr("data-layer-index", item.layerIndex)
      .attr("data-node-index", item.nodeIndex);
    const userAttrs = safeCall("nodeLabelAttrs", options.nodeLabelAttrs, datum);
    setAttrs(
      text,
      mergeAttrs(
        { ...LABEL_DEFAULT_ATTRS, x: item.x, y: item.y, class: cls("node-label") },
        userAttrs,
      ),
    );
    text.text(String(raw));
  }

  return svg.node() as SVGSVGElement;
}

/**
 * Creates an SVG with {@link createDenseNetworkSvg}, replaces the container
 * contents with it, and returns the SVG (spec §3.2).
 */
export function renderDenseNetworkSvg(
  container: Element,
  options: DenseNetworkSvgOptions,
): SVGSVGElement {
  const svg = createDenseNetworkSvg(options);
  container.replaceChildren(svg);
  return svg;
}
