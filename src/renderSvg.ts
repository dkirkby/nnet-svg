// SVG rendering (DESIGN_SPEC.md §3, §7, §10, §11, §15, §19, §21–§23).

import { create } from "d3-selection";
import type { Selection } from "d3-selection";
import { layoutDenseNetwork } from "./layout.js";
import { validateSvgOptions } from "./validate.js";
import type { DenseNetworkSvgOptions, SvgAttrs } from "./types.js";

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
 * Creates and returns a new `SVGSVGElement` displaying the network.
 * This is the primary public API (spec §3.1).
 */
export function createDenseNetworkSvg(options: DenseNetworkSvgOptions): SVGSVGElement {
  validateSvgOptions(options);
  const layout = layoutDenseNetwork(options);

  const classPrefix = options.classPrefix ?? "dn";
  const cls = (name: string) => `${classPrefix}-${name}`;
  const responsive = options.responsive ?? true;
  const { width, height } = layout.viewBox;
  const horizontal = layout.orientation === "horizontal";

  // Root <svg> attributes (spec §7.2, §23): defaults, then responsive attrs,
  // then user svgAttrs. svgAttrs.viewBox is ignored: the viewBox is
  // controlled exclusively by options.viewBox.
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
  svg.append("g").attr("class", cls("labels"));

  for (const edge of layout.edges) {
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
    setAttrs(line, { ...EDGE_DEFAULT_ATTRS, class: cls("edge") });
  }

  for (const item of layout.items) {
    if (item.kind === "node") {
      const circle = itemsGroup
        .append("circle")
        .attr("data-kind", "node")
        .attr("data-layer-index", item.layerIndex)
        .attr("data-node-index", item.nodeIndex)
        .attr("cx", item.x)
        .attr("cy", item.y)
        .attr("r", layout.nodeRadius);
      setAttrs(circle, {
        ...NODE_DEFAULT_ATTRS,
        "stroke-width": layout.nodeStrokeWidth,
        class: cls("node"),
      });
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
