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

  it("stubs throw until their phase lands", () => {
    expect(() => layoutDenseNetwork({ layers: [2, 2] })).toThrow(/not implemented/);
    expect(() => createDenseNetworkSvg({ layers: [2, 2] })).toThrow(/not implemented/);
  });
});
