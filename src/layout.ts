// Layout computation (DESIGN_SPEC.md §8, §9, §12). Implemented in Phase 2.
// This module must stay pure: no DOM access and no d3 imports.

import type { DenseNetworkLayout, DenseNetworkLayoutOptions } from "./types.js";

export function layoutDenseNetwork(
  options: DenseNetworkLayoutOptions,
): DenseNetworkLayout {
  throw new Error("nnet-svg: layoutDenseNetwork is not implemented yet (Phase 2)");
}
