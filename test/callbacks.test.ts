// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDenseNetworkSvg, layoutDenseNetwork } from "../src/index.js";
import type { DenseNetworkSvgOptions } from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const all = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector));
const num = (element: Element, name: string) => parseFloat(element.getAttribute(name)!);

describe("value pass and caching (spec section 14)", () => {
  it("calls nodeValue exactly once per displayed node, with true indices", () => {
    const nodeValue = vi.fn(
      (node: { layerIndex: number; nodeIndex: number }) => node.layerIndex * 100 + node.nodeIndex,
    );
    createDenseNetworkSvg({
      layers: [100, 3],
      maxDisplayedNodes: 6,
      nodeValue,
      // Both consume node.value, which must come from the cache, not re-calls.
      nodeLabel: (node) => node.value,
      nodeAttrs: (node) => ({ "data-value": node.value }),
      nodeTitle: (node) => String(node.value),
    });
    expect(nodeValue).toHaveBeenCalledTimes(6 + 3);
    const layer0Indices = nodeValue.mock.calls
      .map(([ref]) => ref)
      .filter((ref) => ref.layerIndex === 0)
      .map((ref) => ref.nodeIndex);
    expect(layer0Indices).toEqual([0, 1, 2, 97, 98, 99]);
  });

  it("calls edgeValue exactly once per displayed edge", () => {
    const edgeValue = vi.fn(() => 1);
    createDenseNetworkSvg({
      layers: [100, 3],
      maxDisplayedNodes: 6,
      edgeValue,
      edgeAttrs: (edge) => ({ "stroke-width": edge.value }),
      edgeLabel: (edge) => edge.value,
      edgeTitle: (edge) => String(edge.value),
    });
    expect(edgeValue).toHaveBeenCalledTimes(6 * 3);
  });

  it("exposes cached values to attrs and label callbacks", () => {
    const seen: (number | undefined)[] = [];
    const svg = createDenseNetworkSvg({
      layers: [2, 2],
      nodeValue: (node) => node.layerIndex + node.nodeIndex / 10,
      nodeAttrs: (node) => {
        seen.push(node.value);
        return null;
      },
      nodeLabel: (node) => node.value!.toFixed(1),
    });
    expect(seen).toEqual([0, 0.1, 1, 1.1]);
    const labels = all(svg, ".dn-node-label").map((label) => label.textContent);
    expect(labels).toEqual(["0.0", "0.1", "1.0", "1.1"]);
  });

  it("preserves NaN, Infinity, and -Infinity; null/undefined mean no value", () => {
    const returned = [NaN, Infinity, -Infinity, 0, null, undefined];
    const received: (number | undefined)[] = [];
    createDenseNetworkSvg({
      layers: [6, 1],
      nodeValue: (node) => (node.layerIndex === 0 ? returned[node.nodeIndex] : null),
      nodeAttrs: (node) => {
        if (node.layerIndex === 0) received.push(node.value);
        return null;
      },
    });
    expect(received).toEqual([NaN, Infinity, -Infinity, 0, undefined, undefined]);
  });

  it("logs and ignores non-number values in non-strict mode", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const received: (number | undefined)[] = [];
    createDenseNetworkSvg({
      layers: [2, 1],
      nodeValue: () => "not a number" as unknown as number,
      nodeAttrs: (node) => {
        received.push(node.value);
        return null;
      },
    });
    expect(received).toEqual([undefined, undefined, undefined]);
    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(
      /nodeValue must return a number, null, or undefined/,
    );
  });
});

describe("attribute callbacks (spec section 15)", () => {
  it("merges nodeAttrs over defaults, appending class", () => {
    const svg = createDenseNetworkSvg({
      layers: [2, 1],
      nodeAttrs: (node) =>
        node.layerIndex === 0 ? { fill: "red", class: "hot" } : null,
    });
    const circles = all(svg, "circle[data-kind=node]");
    expect(circles[0].getAttribute("fill")).toBe("red"); // overridden
    expect(circles[0].getAttribute("stroke")).toBe("currentColor"); // default kept
    expect(circles[0].getAttribute("class")).toBe("dn-node hot"); // appended
    expect(circles[2].getAttribute("fill")).toBe("white"); // null -> pure defaults
    expect(circles[2].getAttribute("class")).toBe("dn-node");
  });

  it("passes true indices and cached values to edgeAttrs", () => {
    const svg = createDenseNetworkSvg({
      layers: [100, 3],
      maxDisplayedNodes: 6,
      edgeValue: (edge) => edge.sourceNodeIndex,
      edgeAttrs: (edge) => ({ "stroke-width": 1 + (edge.value ?? 0) / 100 }),
    });
    const lines = all(svg, "line");
    expect(lines[lines.length - 1].getAttribute("stroke-width")).toBe("1.99");
    expect(lines[0].getAttribute("stroke-width")).toBe("1");
    expect(lines[0].getAttribute("stroke")).toBe("currentColor"); // default kept
  });
});

describe("labels (spec section 16)", () => {
  it("renders node labels at node centers via String conversion", () => {
    const options: DenseNetworkSvgOptions = {
      layers: [2, 1],
      nodeLabel: (node) => (node.layerIndex === 0 ? node.nodeIndex : null),
    };
    const svg = createDenseNetworkSvg(options);
    const layout = layoutDenseNetwork(options);
    const labels = all(svg, ".dn-node-label");
    expect(labels).toHaveLength(2);
    // The number 0 is a valid label ("0"), not a skipped falsy value.
    expect(labels.map((label) => label.textContent)).toEqual(["0", "1"]);
    const nodes = layout.items.filter((item) => item.kind === "node");
    labels.forEach((label, i) => {
      expect(num(label, "x")).toBeCloseTo(nodes[i].x, 9);
      expect(num(label, "y")).toBeCloseTo(nodes[i].y, 9);
    });
    expect(labels[0].getAttribute("text-anchor")).toBe("middle");
    expect(labels[0].getAttribute("dominant-baseline")).toBe("middle");
    expect(labels[0].getAttribute("pointer-events")).toBe("none");
    expect(labels[0].getAttribute("fill")).toBe("currentColor");
    expect(labels[0].getAttribute("font-size")).toBe("10");
  });

  it("places edge labels at the default edgeLabelPos of 0.4 from the source", () => {
    const options: DenseNetworkSvgOptions = {
      layers: [2, 2],
      edgeLabel: (edge) => `e${edge.edgeIndex}`,
    };
    const svg = createDenseNetworkSvg(options);
    const layout = layoutDenseNetwork(options);
    expect(layout.edgeLabelPos).toBe(0.4);
    const labels = all(svg, ".dn-edge-label");
    expect(labels).toHaveLength(4);
    labels.forEach((label, i) => {
      const edge = layout.edges[i];
      expect(num(label, "x")).toBeCloseTo(edge.x1 + 0.4 * (edge.x2 - edge.x1), 9);
      expect(num(label, "y")).toBeCloseTo(edge.y1 + 0.4 * (edge.y2 - edge.y1), 9);
      expect(label.textContent).toBe(`e${i}`);
    });
  });

  it("honors an explicit edgeLabelPos (0.5 restores the midpoint)", () => {
    const options: DenseNetworkSvgOptions = {
      layers: [2, 2],
      edgeLabelPos: 0.5,
      edgeLabel: (edge) => `e${edge.edgeIndex}`,
    };
    const svg = createDenseNetworkSvg(options);
    const layout = layoutDenseNetwork(options);
    all(svg, ".dn-edge-label").forEach((label, i) => {
      const edge = layout.edges[i];
      expect(num(label, "x")).toBeCloseTo((edge.x1 + edge.x2) / 2, 9);
      expect(num(label, "y")).toBeCloseTo((edge.y1 + edge.y2) / 2, 9);
    });
  });

  it("separates symmetric edge labels that coincide at the midpoint", () => {
    // In a [2, 2] network the two crossing edges (0->1 and 1->0) intersect
    // exactly at the center, so midpoint labels would sit on top of each other.
    const at = (pos?: number) => {
      const svg = createDenseNetworkSvg({
        layers: [2, 2],
        ...(pos === undefined ? {} : { edgeLabelPos: pos }),
        edgeLabel: (edge) => `e${edge.edgeIndex}`,
      });
      return all(svg, ".dn-edge-label").map((label) => `${num(label, "x")},${num(label, "y")}`);
    };
    const midpoint = at(0.5);
    expect(midpoint[1]).toBe(midpoint[2]); // crossing edges e1 and e2 collide
    const defaults = at();
    expect(new Set(defaults).size).toBe(4); // all four labels distinct
  });

  it("skips null/undefined labels entirely", () => {
    const svg = createDenseNetworkSvg({
      layers: [3, 2],
      nodeLabel: (node) => (node.nodeIndex === 1 ? "mid" : null),
      edgeLabel: () => undefined,
    });
    const nodeLabels = all(svg, ".dn-node-label");
    expect(nodeLabels).toHaveLength(2); // one per layer
    expect(all(svg, ".dn-edge-label")).toHaveLength(0);
  });

  it("merges label attrs over label defaults, appending class", () => {
    const svg = createDenseNetworkSvg({
      layers: [2, 1],
      nodeLabel: () => "x",
      nodeLabelAttrs: (node) => ({ "font-size": 8, class: `l${node.layerIndex}` }),
    });
    const label = svg.querySelector(".dn-node-label")!;
    expect(label.getAttribute("font-size")).toBe("8");
    expect(label.getAttribute("class")).toBe("dn-node-label l0");
    expect(label.getAttribute("text-anchor")).toBe("middle"); // default kept
  });

  it("draws labels in the labels group, above edges and items", () => {
    const svg = createDenseNetworkSvg({
      layers: [2, 2],
      nodeLabel: () => "n",
      edgeLabel: () => "e",
    });
    const labelsGroup = svg.querySelector(".dn-labels")!;
    expect(svg.lastElementChild).toBe(labelsGroup);
    expect(labelsGroup.querySelectorAll("text")).toHaveLength(4 + 4);
    expect(all(svg, "text")).toHaveLength(8); // none outside the group
  });
});

describe("error handling and strict mode (spec section 24)", () => {
  const callbackNames = [
    "nodeValue",
    "edgeValue",
    "nodeAttrs",
    "edgeAttrs",
    "nodeLabel",
    "edgeLabel",
    "nodeLabelAttrs",
    "edgeLabelAttrs",
    "nodeTitle",
    "edgeTitle",
  ] as const;

  function throwingOptions(
    name: (typeof callbackNames)[number],
    strict: boolean,
  ): DenseNetworkSvgOptions {
    const options: DenseNetworkSvgOptions = { layers: [2, 2], strict };
    // Label-attr callbacks only run when a label is rendered.
    if (name === "nodeLabelAttrs") options.nodeLabel = () => "x";
    if (name === "edgeLabelAttrs") options.edgeLabel = () => "x";
    (options as Record<string, unknown>)[name] = () => {
      throw new Error(`${name} boom`);
    };
    return options;
  }

  for (const name of callbackNames) {
    it(`non-strict: logs and keeps rendering when ${name} throws`, () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const svg = createDenseNetworkSvg(throwingOptions(name, false));
      expect(errorSpy).toHaveBeenCalled();
      expect(String(errorSpy.mock.calls[0][0])).toContain(name);
      expect(all(svg, "circle[data-kind=node]")).toHaveLength(4);
      expect(all(svg, "line")).toHaveLength(4);
    });

    it(`strict: rethrows when ${name} throws`, () => {
      expect(() => createDenseNetworkSvg(throwingOptions(name, true))).toThrow(`${name} boom`);
    });
  }

  it("falls back to default attrs when nodeAttrs throws in non-strict mode", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const svg = createDenseNetworkSvg(throwingOptions("nodeAttrs", false));
    const circle = svg.querySelector("circle[data-kind=node]")!;
    expect(circle.getAttribute("fill")).toBe("white");
    expect(circle.getAttribute("class")).toBe("dn-node");
  });

  it("strict mode throws on non-number nodeValue results", () => {
    expect(() =>
      createDenseNetworkSvg({
        layers: [2, 2],
        strict: true,
        nodeValue: () => "bad" as unknown as number,
      }),
    ).toThrow(/nodeValue must return a number, null, or undefined/);
  });

  it("strict mode throws on non-number edgeValue results", () => {
    expect(() =>
      createDenseNetworkSvg({
        layers: [2, 2],
        strict: true,
        edgeValue: () => ({}) as unknown as number,
      }),
    ).toThrow(/edgeValue must return a number, null, or undefined/);
  });
});

describe("titles (spec section 17)", () => {
  it("adds <title> children to nodes and edges, skipping null", () => {
    const svg = createDenseNetworkSvg({
      layers: [2, 1],
      nodeTitle: (node) =>
        node.layerIndex === 0 && node.nodeIndex === 0 ? "first node" : null,
      edgeTitle: (edge) => `edge ${edge.edgeIndex}`,
    });
    const nodeTitles = all(svg, "circle > title");
    expect(nodeTitles).toHaveLength(1);
    expect(nodeTitles[0].textContent).toBe("first node");
    const edgeTitles = all(svg, "line > title");
    expect(edgeTitles).toHaveLength(2);
    expect(edgeTitles.map((title) => title.textContent)).toEqual(["edge 0", "edge 1"]);
  });
});
