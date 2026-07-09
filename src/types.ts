// Public type definitions (DESIGN_SPEC.md §12, §13, §25).
// Phase 0 placeholder: minimal provisional shapes so the skeleton compiles.
// The full definitions land in Phase 1.

export type Orientation = "horizontal" | "vertical";

export interface DenseNetworkLayoutOptions {
  layers: number[];
}

export interface DenseNetworkSvgOptions extends DenseNetworkLayoutOptions {}

export interface DenseNetworkLayout {
  orientation: Orientation;
}
