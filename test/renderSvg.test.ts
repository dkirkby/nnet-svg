// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createDenseNetworkSvg,
  layoutDenseNetwork,
  renderDenseNetworkSvg,
} from "../src/index.js";

const all = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector));
const num = (element: Element, name: string) => parseFloat(element.getAttribute(name)!);

describe("root <svg>", () => {
  it("returns an SVGSVGElement in the SVG namespace", () => {
    const svg = createDenseNetworkSvg({ layers: [3, 2] });
    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("is responsive by default: viewBox, width 100%, no height", () => {
    const svg = createDenseNetworkSvg({ layers: [3, 2] });
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 360");
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.hasAttribute("height")).toBe(false);
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(svg.getAttribute("style")).toContain("max-width: 100%");
    expect(svg.getAttribute("style")).toContain("height: auto");
  });

  it("uses fixed dimensions when responsive is false", () => {
    const svg = createDenseNetworkSvg({ layers: [3, 2], responsive: false });
    expect(svg.getAttribute("width")).toBe("640");
    expect(svg.getAttribute("height")).toBe("360");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("derives the viewBox attribute from options.viewBox", () => {
    const svg = createDenseNetworkSvg({
      layers: [3, 2],
      viewBox: { width: 320, height: 180 },
      responsive: false,
    });
    expect(svg.getAttribute("viewBox")).toBe("0 0 320 180");
    expect(svg.getAttribute("width")).toBe("320");
    expect(svg.getAttribute("height")).toBe("180");
  });

  it("merges svgAttrs, appending class and protecting viewBox", () => {
    const svg = createDenseNetworkSvg({
      layers: [3, 2],
      svgAttrs: {
        class: "my-net",
        viewBox: "0 0 1 1",
        preserveAspectRatio: "none",
        "data-test": "yes",
        width: null,
      },
    });
    expect(svg.getAttribute("class")).toBe("dn-root my-net");
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 360"); // never overridable
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none"); // overridable
    expect(svg.getAttribute("data-test")).toBe("yes");
    expect(svg.hasAttribute("width")).toBe(false); // null removes a default
  });

  it("validates rendering options", () => {
    expect(() => createDenseNetworkSvg({ layers: [3, 2], responsive: 1 as never })).toThrow(
      /responsive must be a boolean/,
    );
  });
});

describe("structure and drawing order", () => {
  const svg = createDenseNetworkSvg({ layers: [100, 4, 2], maxDisplayedNodes: 6 });

  it("has edges, items, labels groups in that order", () => {
    const groups = Array.from(svg.children).filter((child) => child.tagName === "g");
    expect(groups.map((group) => group.getAttribute("class"))).toEqual([
      "dn-edges",
      "dn-items",
      "dn-labels",
    ]);
  });

  it("keeps all edges inside the edges group, before nodes in document order", () => {
    const edgesGroup = svg.querySelector(".dn-edges")!;
    expect(all(svg, "line")).toHaveLength(edgesGroup.querySelectorAll("line").length);
    // 6 displayed real nodes x 4 + 4 x 2 edges
    expect(all(svg, "line")).toHaveLength(32);
  });

  it("renders one circle per displayed node and one glyph per ellipsis", () => {
    expect(all(svg, "circle[data-kind=node]")).toHaveLength(6 + 4 + 2);
    const glyphs = all(svg, "g[data-kind=ellipsis]");
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0].querySelectorAll("circle")).toHaveLength(3);
  });

  it("renames every generated class with classPrefix", () => {
    const custom = createDenseNetworkSvg({
      layers: [100, 4],
      maxDisplayedNodes: 6,
      classPrefix: "nn",
    });
    expect(custom.getAttribute("class")).toBe("nn-root");
    for (const name of ["edges", "items", "labels", "edge", "node", "ellipsis", "ellipsis-dot"]) {
      expect(custom.querySelectorAll(`.nn-${name}`).length, name).toBeGreaterThan(0);
      expect(custom.querySelectorAll(`.dn-${name}`).length, name).toBe(0);
    }
  });
});

describe("geometry matches the layout", () => {
  const options = { layers: [3, 8, 4, 1], maxDisplayedNodes: 6 } as const;
  const svg = createDenseNetworkSvg({ ...options, layers: [...options.layers] });
  const layout = layoutDenseNetwork({ ...options, layers: [...options.layers] });

  it("positions circles at layout item coordinates with the resolved radius", () => {
    const circles = all(svg, "circle[data-kind=node]");
    const nodeItems = layout.items.filter((item) => item.kind === "node");
    expect(circles).toHaveLength(nodeItems.length);
    circles.forEach((circle, i) => {
      expect(num(circle, "cx")).toBeCloseTo(nodeItems[i].x, 9);
      expect(num(circle, "cy")).toBeCloseTo(nodeItems[i].y, 9);
      expect(num(circle, "r")).toBeCloseTo(layout.nodeRadius, 9);
    });
  });

  it("positions lines at layout edge coordinates, in edge order", () => {
    const lines = all(svg, "line");
    expect(lines).toHaveLength(layout.edges.length);
    lines.forEach((line, i) => {
      const edge = layout.edges[i];
      expect(num(line, "x1")).toBeCloseTo(edge.x1, 9);
      expect(num(line, "y1")).toBeCloseTo(edge.y1, 9);
      expect(num(line, "x2")).toBeCloseTo(edge.x2, 9);
      expect(num(line, "y2")).toBeCloseTo(edge.y2, 9);
      expect(line.getAttribute("data-edge-index")).toBe(String(edge.edgeIndex));
    });
  });
});

describe("data attributes", () => {
  const svg = createDenseNetworkSvg({ layers: [100, 3], maxDisplayedNodes: 6 });

  it("nodes carry true original indices", () => {
    const indices = all(svg, "circle[data-kind=node][data-layer-index='0']").map((circle) =>
      circle.getAttribute("data-node-index"),
    );
    expect(indices).toEqual(["0", "1", "2", "97", "98", "99"]);
  });

  it("ellipsis carries layer index and omitted count", () => {
    const glyph = svg.querySelector("g[data-kind=ellipsis]")!;
    expect(glyph.getAttribute("data-layer-index")).toBe("0");
    expect(glyph.getAttribute("data-omitted-count")).toBe("94");
  });

  it("edges carry true source/target indices and a global edge index", () => {
    const lines = all(svg, "line");
    const first = lines[0];
    expect(first.getAttribute("data-kind")).toBe("edge");
    expect(first.getAttribute("data-source-layer-index")).toBe("0");
    expect(first.getAttribute("data-source-node-index")).toBe("0");
    expect(first.getAttribute("data-target-layer-index")).toBe("1");
    expect(first.getAttribute("data-target-node-index")).toBe("0");
    expect(first.getAttribute("data-edge-index")).toBe("0");
    const last = lines[lines.length - 1];
    expect(last.getAttribute("data-source-node-index")).toBe("99");
    expect(last.getAttribute("data-target-node-index")).toBe("2");
  });
});

describe("default styling", () => {
  const svg = createDenseNetworkSvg({ layers: [100, 3], maxDisplayedNodes: 6 });

  it("styles nodes as white circles with currentColor strokes", () => {
    const circle = svg.querySelector("circle[data-kind=node]")!;
    expect(circle.getAttribute("fill")).toBe("white");
    expect(circle.getAttribute("stroke")).toBe("currentColor");
    expect(circle.getAttribute("stroke-width")).toBe("1.5");
  });

  it("styles edges as translucent currentColor lines", () => {
    const line = svg.querySelector("line")!;
    expect(line.getAttribute("stroke")).toBe("currentColor");
    expect(line.getAttribute("stroke-opacity")).toBe("0.25");
    expect(line.getAttribute("stroke-width")).toBe("1");
  });

  it("fills ellipsis dots with currentColor", () => {
    const dot = svg.querySelector(".dn-ellipsis-dot")!;
    expect(dot.getAttribute("fill")).toBe("currentColor");
  });
});

describe("ellipsis glyph orientation", () => {
  it("stacks dots vertically in horizontal networks", () => {
    const options = { layers: [30, 2], maxDisplayedNodes: 4 };
    const svg = createDenseNetworkSvg(options);
    const layout = layoutDenseNetwork(options);
    const dots = all(svg, ".dn-ellipsis-dot");
    expect(dots).toHaveLength(3);
    const xs = new Set(dots.map((dot) => dot.getAttribute("cx")));
    expect(xs.size).toBe(1); // aligned on x
    const ys = dots.map((dot) => num(dot, "cy")).sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBeCloseTo(3 * layout.ellipsisDotRadius, 9);
    expect(ys[2] - ys[1]).toBeCloseTo(3 * layout.ellipsisDotRadius, 9);
    dots.forEach((dot) => expect(num(dot, "r")).toBeCloseTo(layout.ellipsisDotRadius, 9));
  });

  it("stacks dots horizontally in vertical networks", () => {
    const svg = createDenseNetworkSvg({
      layers: [30, 2],
      maxDisplayedNodes: 4,
      orientation: "vertical",
    });
    const dots = all(svg, ".dn-ellipsis-dot");
    const ys = new Set(dots.map((dot) => dot.getAttribute("cy")));
    expect(ys.size).toBe(1); // aligned on y
    const xs = new Set(dots.map((dot) => dot.getAttribute("cx")));
    expect(xs.size).toBe(3);
  });
});

describe("renderDenseNetworkSvg", () => {
  it("replaces container contents and returns the mounted SVG", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>old content</p><span>more</span>";
    const svg = renderDenseNetworkSvg(container, { layers: [2, 2] });
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(svg);
    expect(svg).toBeInstanceOf(SVGSVGElement);
  });
});
