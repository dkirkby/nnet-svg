// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateLayoutOptions, validateSvgOptions } from "../src/validate.js";

// Deliberately ill-typed inputs exercise the runtime checks.
const layout = (options: unknown) => () =>
  validateLayoutOptions(options as Parameters<typeof validateLayoutOptions>[0]);
const svg = (options: unknown) => () =>
  validateSvgOptions(options as Parameters<typeof validateSvgOptions>[0]);

describe("validateLayoutOptions", () => {
  it("rejects non-object options", () => {
    expect(layout(undefined)).toThrow(/options must be an object/);
    expect(layout(null)).toThrow(/options must be an object/);
    expect(layout("layers")).toThrow(/options must be an object/);
  });

  it("requires layers", () => {
    expect(layout({})).toThrow(/layers is required/);
  });

  it("rejects a non-array layers", () => {
    expect(layout({ layers: 3 })).toThrow(/layers must be an array/);
    expect(layout({ layers: "3,2" })).toThrow(/layers must be an array/);
  });

  it("requires at least 2 layers", () => {
    expect(layout({ layers: [] })).toThrow(/at least 2 layer sizes; received 0/);
    expect(layout({ layers: [5] })).toThrow(/at least 2 layer sizes; received 1/);
    expect(layout({ layers: [5, 1] })).not.toThrow();
  });

  it("requires every layer size to be a positive integer", () => {
    expect(layout({ layers: [3, 0] })).toThrow(/layers\[1\] is 0/);
    expect(layout({ layers: [-2, 3] })).toThrow(/layers\[0\] is -2/);
    expect(layout({ layers: [3, 2.5] })).toThrow(/layers\[1\] is 2.5/);
    expect(layout({ layers: [3, NaN] })).toThrow(/layers\[1\] is NaN/);
    expect(layout({ layers: [3, Infinity] })).toThrow(/layers\[1\] is Infinity/);
    expect(layout({ layers: [3, "4"] })).toThrow(/layers\[1\] is "4"/);
    expect(layout({ layers: [3, null] })).toThrow(/layers\[1\] is null/);
  });

  it("requires maxDisplayedNodes to be an even integer >= 2", () => {
    for (const bad of [3, 0, -2, 2.5, NaN, Infinity, "8", true]) {
      expect(layout({ layers: [3, 2], maxDisplayedNodes: bad })).toThrow(
        /maxDisplayedNodes must be an even integer >= 2/,
      );
    }
    expect(layout({ layers: [3, 2], maxDisplayedNodes: 2 })).not.toThrow();
    expect(layout({ layers: [3, 2], maxDisplayedNodes: 12 })).not.toThrow();
  });

  it("requires a valid orientation when provided", () => {
    expect(layout({ layers: [3, 2], orientation: "diagonal" })).toThrow(
      /orientation must be "horizontal" or "vertical"; received "diagonal"/,
    );
    expect(layout({ layers: [3, 2], orientation: 5 })).toThrow(/orientation/);
    expect(layout({ layers: [3, 2], orientation: "horizontal" })).not.toThrow();
    expect(layout({ layers: [3, 2], orientation: "vertical" })).not.toThrow();
  });

  it("requires viewBox dimensions to be positive finite numbers", () => {
    expect(layout({ layers: [3, 2], viewBox: null })).toThrow(/viewBox must be an object/);
    expect(layout({ layers: [3, 2], viewBox: 640 })).toThrow(/viewBox must be an object/);
    for (const bad of [0, -5, NaN, Infinity, "640", undefined]) {
      expect(layout({ layers: [3, 2], viewBox: { width: bad, height: 360 } })).toThrow(
        /viewBox\.width must be a positive finite number/,
      );
      expect(layout({ layers: [3, 2], viewBox: { width: 640, height: bad } })).toThrow(
        /viewBox\.height must be a positive finite number/,
      );
    }
    expect(layout({ layers: [3, 2], viewBox: { width: 640, height: 360 } })).not.toThrow();
  });

  it("requires spreads to be finite numbers >= -1", () => {
    for (const name of ["nodeSpread", "layerSpread"]) {
      for (const bad of [-1.5, NaN, Infinity, -Infinity, "1", false]) {
        expect(layout({ layers: [3, 2], [name]: bad })).toThrow(
          new RegExp(`${name} must be a finite number >= -1`),
        );
      }
      for (const good of [-1, -0.5, 0, 1, 2.5]) {
        expect(layout({ layers: [3, 2], [name]: good })).not.toThrow();
      }
    }
  });

  it("requires radii to be positive finite numbers", () => {
    for (const name of ["nodeRadius", "ellipsisDotRadius"]) {
      for (const bad of [0, -1, NaN, Infinity, "5"]) {
        expect(layout({ layers: [3, 2], [name]: bad })).toThrow(
          new RegExp(`${name} must be a positive finite number`),
        );
      }
      expect(layout({ layers: [3, 2], [name]: 5 })).not.toThrow();
    }
  });

  it("ignores rendering-only options", () => {
    expect(
      layout({ layers: [3, 2], responsive: "yes", strict: 1, nodeLabel: "bad" }),
    ).not.toThrow();
  });

  it("accepts a fully specified valid configuration", () => {
    expect(
      layout({
        layers: [3, 8, 4, 1],
        maxDisplayedNodes: 6,
        orientation: "vertical",
        viewBox: { width: 400, height: 800 },
        nodeSpread: -1,
        layerSpread: 1,
        nodeRadius: 8,
        ellipsisDotRadius: 2,
      }),
    ).not.toThrow();
  });
});

describe("validateSvgOptions", () => {
  it("applies all layout rules", () => {
    expect(svg({ layers: [1] })).toThrow(/at least 2 layer sizes/);
    expect(svg({ layers: [3, 2], maxDisplayedNodes: 5 })).toThrow(/maxDisplayedNodes/);
  });

  it("requires responsive and strict to be booleans when provided", () => {
    for (const name of ["responsive", "strict"]) {
      for (const bad of ["yes", 1, 0, null]) {
        expect(svg({ layers: [3, 2], [name]: bad })).toThrow(
          new RegExp(`${name} must be a boolean`),
        );
      }
      expect(svg({ layers: [3, 2], [name]: true })).not.toThrow();
      expect(svg({ layers: [3, 2], [name]: false })).not.toThrow();
    }
  });
});
