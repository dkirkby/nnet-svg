// Input validation (DESIGN_SPEC.md §5).
// Top-level invalid inputs always throw descriptive errors, regardless of `strict`.

import type { DenseNetworkLayoutOptions, DenseNetworkSvgOptions } from "./types.js";

function fail(message: string): never {
  throw new Error(`nnet-svg: ${message}`);
}

function show(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(show).join(", ")}]`;
  if (typeof value === "function") return "a function";
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }
  // Covers numbers (incl. NaN/Infinity), booleans, null, undefined, symbols, bigints.
  return String(value);
}

/**
 * Validates the layout-level options (spec §5). Rendering-only options such as
 * callbacks, labels and `responsive` are ignored here (spec §3.3).
 */
export function validateLayoutOptions(options: DenseNetworkLayoutOptions): void {
  if (typeof options !== "object" || options === null) {
    fail(`options must be an object; received ${show(options)}`);
  }

  const {
    layers,
    maxDisplayedNodes,
    orientation,
    viewBox,
    nodeSpread,
    layerSpread,
    nodeRadius,
    ellipsisDotRadius,
    nodeStrokeWidth,
    edgeLabelPos,
  } = options;

  if (layers === undefined) {
    fail("layers is required");
  }
  if (!Array.isArray(layers)) {
    fail(`layers must be an array of positive integers; received ${show(layers)}`);
  }
  if (layers.length < 2) {
    fail(`layers must contain at least 2 layer sizes; received ${layers.length}`);
  }
  layers.forEach((size, index) => {
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1) {
      fail(`every layer size must be a positive integer; layers[${index}] is ${show(size)}`);
    }
  });

  if (
    maxDisplayedNodes !== undefined &&
    (typeof maxDisplayedNodes !== "number" ||
      !Number.isInteger(maxDisplayedNodes) ||
      maxDisplayedNodes < 2 ||
      maxDisplayedNodes % 2 !== 0)
  ) {
    fail(`maxDisplayedNodes must be an even integer >= 2; received ${show(maxDisplayedNodes)}`);
  }

  if (orientation !== undefined && orientation !== "horizontal" && orientation !== "vertical") {
    fail(`orientation must be "horizontal" or "vertical"; received ${show(orientation)}`);
  }

  if (viewBox !== undefined) {
    if (typeof viewBox !== "object" || viewBox === null) {
      fail(`viewBox must be an object with width and height; received ${show(viewBox)}`);
    }
    for (const dimension of ["width", "height"] as const) {
      const value = viewBox[dimension];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        fail(`viewBox.${dimension} must be a positive finite number; received ${show(value)}`);
      }
    }
  }

  for (const [name, value] of [
    ["nodeSpread", nodeSpread],
    ["layerSpread", layerSpread],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value < -1)
    ) {
      fail(`${name} must be a finite number >= -1; received ${show(value)}`);
    }
  }

  for (const [name, value] of [
    ["nodeRadius", nodeRadius],
    ["ellipsisDotRadius", ellipsisDotRadius],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    ) {
      fail(`${name} must be a positive finite number; received ${show(value)}`);
    }
  }

  // Zero is allowed: it means no visible stroke.
  if (
    nodeStrokeWidth !== undefined &&
    (typeof nodeStrokeWidth !== "number" || !Number.isFinite(nodeStrokeWidth) || nodeStrokeWidth < 0)
  ) {
    fail(`nodeStrokeWidth must be a non-negative finite number; received ${show(nodeStrokeWidth)}`);
  }

  if (
    edgeLabelPos !== undefined &&
    (typeof edgeLabelPos !== "number" ||
      !Number.isFinite(edgeLabelPos) ||
      edgeLabelPos < 0 ||
      edgeLabelPos > 1)
  ) {
    fail(`edgeLabelPos must be a number between 0 and 1; received ${show(edgeLabelPos)}`);
  }
}

/** Validates the full SVG options: layout rules plus rendering-only rules (spec §5). */
export function validateSvgOptions(options: DenseNetworkSvgOptions): void {
  validateLayoutOptions(options);

  for (const name of ["responsive", "strict"] as const) {
    const value = options[name];
    if (value !== undefined && typeof value !== "boolean") {
      fail(`${name} must be a boolean; received ${show(value)}`);
    }
  }
}
