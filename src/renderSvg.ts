// SVG rendering (DESIGN_SPEC.md §3, §10–§24). Implemented in Phases 3–5.

import type { DenseNetworkSvgOptions } from "./types.js";

export function createDenseNetworkSvg(
  options: DenseNetworkSvgOptions,
): SVGSVGElement {
  throw new Error("nnet-svg: createDenseNetworkSvg is not implemented yet (Phase 3)");
}

export function renderDenseNetworkSvg(
  container: Element,
  options: DenseNetworkSvgOptions,
): SVGSVGElement {
  const svg = createDenseNetworkSvg(options);
  container.replaceChildren(svg);
  return svg;
}
