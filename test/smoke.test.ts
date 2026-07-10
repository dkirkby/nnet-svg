// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createDenseNetworkSvg,
  layoutDenseNetwork,
  renderDenseNetworkSvg,
} from "../src/index.js";

describe("package skeleton", () => {
  it("exports the public API", () => {
    expect(typeof createDenseNetworkSvg).toBe("function");
    expect(typeof renderDenseNetworkSvg).toBe("function");
    expect(typeof layoutDenseNetwork).toBe("function");
  });

  it("computes a layout without any DOM (node environment)", () => {
    const layout = layoutDenseNetwork({ layers: [2, 2] });
    expect(layout.items).toHaveLength(4);
    expect(layout.edges).toHaveLength(4);
  });
});
