// Layout computation (DESIGN_SPEC.md §8, §9, §12).
// This module must stay pure: no DOM access and no d3 imports.

import { validateLayoutOptions } from "./validate.js";
import type {
  DenseNetworkLayout,
  DenseNetworkLayoutOptions,
  LayoutEdge,
  LayoutItem,
} from "./types.js";

const DEFAULT_MAX_DISPLAYED_NODES = 12;

const DEFAULT_VIEWBOX = {
  horizontal: { width: 640, height: 360 },
  vertical: { width: 360, height: 640 },
} as const;

/**
 * Positions of `count` points along an axis of length `axisLength` (spec §8):
 * gap = L/(N+spread), inset = (1+spread)/(N+spread) * (L/2), so that
 * 2*inset + (N-1)*gap = L. A single point is centered without evaluating
 * the gap formula (avoids division by zero when spread is -1).
 */
function axisPositions(count: number, axisLength: number, spread: number): number[] {
  if (count === 1) return [axisLength / 2];
  const gap = axisLength / (count + spread);
  const inset = ((1 + spread) / (count + spread)) * (axisLength / 2);
  return Array.from({ length: count }, (_, index) => inset + index * gap);
}

type Slot =
  | { kind: "node"; nodeIndex: number }
  | { kind: "ellipsis"; omittedCount: number };

/**
 * Visible slots for a layer of `size` nodes (spec §9). Layers larger than
 * maxDisplayedNodes get maxDisplayedNodes+1 slots with the central slot
 * replaced by an ellipsis; displayed nodes keep their true indices.
 */
function layerSlots(size: number, maxDisplayedNodes: number): Slot[] {
  if (size <= maxDisplayedNodes) {
    return Array.from({ length: size }, (_, nodeIndex) => ({
      kind: "node" as const,
      nodeIndex,
    }));
  }
  const half = maxDisplayedNodes / 2;
  const slots: Slot[] = [];
  for (let nodeIndex = 0; nodeIndex < half; nodeIndex++) {
    slots.push({ kind: "node", nodeIndex });
  }
  slots.push({ kind: "ellipsis", omittedCount: size - maxDisplayedNodes });
  for (let nodeIndex = size - half; nodeIndex < size; nodeIndex++) {
    slots.push({ kind: "node", nodeIndex });
  }
  return slots;
}

/**
 * Computes node/ellipsis placement and edge geometry without creating any
 * DOM elements. Accepts the full SVG options object; rendering-only options
 * are ignored (spec §3.3).
 */
export function layoutDenseNetwork(options: DenseNetworkLayoutOptions): DenseNetworkLayout {
  validateLayoutOptions(options);

  const orientation = options.orientation ?? "horizontal";
  const viewBox = options.viewBox ?? DEFAULT_VIEWBOX[orientation];
  const maxDisplayedNodes = options.maxDisplayedNodes ?? DEFAULT_MAX_DISPLAYED_NODES;
  const nodeSpread = options.nodeSpread ?? 0;
  const layerSpread = options.layerSpread ?? 0;

  const horizontal = orientation === "horizontal";
  const layerAxisLength = horizontal ? viewBox.width : viewBox.height;
  const nodeAxisLength = horizontal ? viewBox.height : viewBox.width;

  const layerPositions = axisPositions(options.layers.length, layerAxisLength, layerSpread);

  const items: LayoutItem[] = [];
  // Displayed real nodes per layer, in visible order, for edge generation.
  const displayedNodes: { nodeIndex: number; x: number; y: number }[][] = [];
  let smallestNodeGap = Infinity;

  options.layers.forEach((size, layerIndex) => {
    const slots = layerSlots(size, maxDisplayedNodes);
    const nodePositions = axisPositions(slots.length, nodeAxisLength, nodeSpread);
    if (slots.length > 1) {
      smallestNodeGap = Math.min(smallestNodeGap, nodeAxisLength / (slots.length + nodeSpread));
    }
    const layerNodes: { nodeIndex: number; x: number; y: number }[] = [];
    slots.forEach((slot, visibleIndex) => {
      const layerPosition = layerPositions[layerIndex];
      const nodePosition = nodePositions[visibleIndex];
      const x = horizontal ? layerPosition : nodePosition;
      const y = horizontal ? nodePosition : layerPosition;
      if (slot.kind === "node") {
        items.push({ kind: "node", layerIndex, nodeIndex: slot.nodeIndex, visibleIndex, x, y });
        layerNodes.push({ nodeIndex: slot.nodeIndex, x, y });
      } else {
        items.push({
          kind: "ellipsis",
          layerIndex,
          visibleIndex,
          omittedCount: slot.omittedCount,
          x,
          y,
        });
      }
    });
    displayedNodes.push(layerNodes);
  });

  // Default radius: 1/8 of the smallest displayed inter-node gap; if every
  // layer displays a single node there is no gap, so fall back to L/25 (spec §8).
  const nodeRadius =
    options.nodeRadius ??
    (Number.isFinite(smallestNodeGap) ? smallestNodeGap / 8 : nodeAxisLength / 25);
  const ellipsisDotRadius = options.ellipsisDotRadius ?? nodeRadius / 4;

  const edges: LayoutEdge[] = [];
  let edgeIndex = 0;
  for (let layerIndex = 0; layerIndex + 1 < displayedNodes.length; layerIndex++) {
    for (const source of displayedNodes[layerIndex]) {
      for (const target of displayedNodes[layerIndex + 1]) {
        edges.push({
          sourceLayerIndex: layerIndex,
          sourceNodeIndex: source.nodeIndex,
          targetLayerIndex: layerIndex + 1,
          targetNodeIndex: target.nodeIndex,
          edgeIndex: edgeIndex++,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
        });
      }
    }
  }

  return {
    viewBox: { width: viewBox.width, height: viewBox.height },
    orientation,
    items,
    edges,
    nodeRadius,
    ellipsisDotRadius,
  };
}
