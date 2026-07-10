// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDenseNetworkSvg } from "../src/index.js";

const topTitle = (svg: SVGSVGElement) => svg.querySelector(":scope > title");
const topDesc = (svg: SVGSVGElement) => svg.querySelector(":scope > desc");

describe("accessibility metadata (spec section 18)", () => {
  it("sets role=img on the root", () => {
    expect(createDenseNetworkSvg({ layers: [2, 2] }).getAttribute("role")).toBe("img");
  });

  it("renders a top-level <title> before the drawing groups when given", () => {
    const svg = createDenseNetworkSvg({ layers: [2, 2], title: "My network" });
    expect(topTitle(svg)!.textContent).toBe("My network");
    expect(svg.firstElementChild!.tagName).toBe("title");
  });

  it("omits the top-level <title> when not given", () => {
    const svg = createDenseNetworkSvg({ layers: [2, 2] });
    expect(topTitle(svg)).toBeNull();
  });

  it("generates a default description summarizing the network", () => {
    const svg = createDenseNetworkSvg({ layers: [100, 3], maxDisplayedNodes: 6 });
    const desc = topDesc(svg)!.textContent!;
    expect(desc).toContain("2 layers");
    expect(desc).toContain("100, 3");
    expect(desc).toContain("horizontal");
    expect(desc).toContain("more than 6 nodes");
  });

  it("omits the truncation sentence when nothing is truncated", () => {
    const svg = createDenseNetworkSvg({ layers: [3, 2], orientation: "vertical" });
    const desc = topDesc(svg)!.textContent!;
    expect(desc).toContain("vertical");
    expect(desc).not.toContain("truncated");
  });

  it("uses an explicit desc verbatim", () => {
    const svg = createDenseNetworkSvg({ layers: [2, 2], desc: "Custom description." });
    expect(topDesc(svg)!.textContent).toBe("Custom description.");
  });

  it("wires aria-labelledby to exactly the ids that exist", () => {
    const withTitle = createDenseNetworkSvg({ layers: [2, 2], title: "t" });
    const ids = withTitle.getAttribute("aria-labelledby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(topTitle(withTitle)!.id).toBe(ids[0]);
    expect(topDesc(withTitle)!.id).toBe(ids[1]);

    const withoutTitle = createDenseNetworkSvg({ layers: [2, 2] });
    const soleId = withoutTitle.getAttribute("aria-labelledby")!;
    expect(soleId).not.toContain(" ");
    expect(topDesc(withoutTitle)!.id).toBe(soleId);
  });
});

describe("generated ids (spec section 20)", () => {
  it("uses an explicit idPrefix verbatim", () => {
    const svg = createDenseNetworkSvg({ layers: [2, 2], idPrefix: "net1", title: "t" });
    expect(topTitle(svg)!.id).toBe("net1-title");
    expect(topDesc(svg)!.id).toBe("net1-desc");
  });

  it("generates distinct ids for independent networks on the same page", () => {
    const first = createDenseNetworkSvg({ layers: [2, 2] });
    const second = createDenseNetworkSvg({ layers: [2, 2] });
    expect(topDesc(first)!.id).not.toBe("");
    expect(topDesc(first)!.id).not.toBe(topDesc(second)!.id);
  });

  it("does not assign ids to nodes and edges", () => {
    const svg = createDenseNetworkSvg({ layers: [2, 2] });
    for (const element of Array.from(svg.querySelectorAll("circle, line"))) {
      expect(element.hasAttribute("id")).toBe(false);
    }
  });
});
