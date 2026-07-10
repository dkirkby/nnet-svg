// @vitest-environment node
import { describe, expect, it } from "vitest";
import { layoutDenseNetwork } from "../src/index.js";
import type {
  DenseNetworkLayout,
  LayoutEllipsisItem,
  LayoutNodeItem,
} from "../src/index.js";

function layerItems(layout: DenseNetworkLayout, layerIndex: number) {
  return layout.items.filter((item) => item.layerIndex === layerIndex);
}

function layerNodes(layout: DenseNetworkLayout, layerIndex: number): LayoutNodeItem[] {
  return layerItems(layout, layerIndex).filter((item) => item.kind === "node");
}

function expectClose(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 9);
}

describe("defaults", () => {
  it("uses a 640x360 viewBox for horizontal orientation", () => {
    const layout = layoutDenseNetwork({ layers: [3, 2] });
    expect(layout.orientation).toBe("horizontal");
    expect(layout.viewBox).toEqual({ width: 640, height: 360 });
  });

  it("uses a 360x640 viewBox for vertical orientation", () => {
    const layout = layoutDenseNetwork({ layers: [3, 2], orientation: "vertical" });
    expect(layout.viewBox).toEqual({ width: 360, height: 640 });
  });

  it("passes an explicit viewBox through", () => {
    const layout = layoutDenseNetwork({ layers: [3, 2], viewBox: { width: 100, height: 50 } });
    expect(layout.viewBox).toEqual({ width: 100, height: 50 });
  });

  it("defaults maxDisplayedNodes to 12", () => {
    const untruncated = layoutDenseNetwork({ layers: [12, 2] });
    expect(untruncated.items.filter((item) => item.kind === "ellipsis")).toHaveLength(0);

    const truncated = layoutDenseNetwork({ layers: [13, 2] });
    const ellipses = truncated.items.filter((item) => item.kind === "ellipsis");
    expect(ellipses).toHaveLength(1);
    expect((ellipses[0] as LayoutEllipsisItem).omittedCount).toBe(1);
  });

  it("validates input (validation is wired in)", () => {
    expect(() => layoutDenseNetwork({ layers: [5] })).toThrow(/at least 2 layer sizes/);
  });

  it("accepts and ignores rendering-only options", () => {
    const layout = layoutDenseNetwork({
      layers: [3, 2],
      responsive: false,
      title: "net",
      nodeLabel: () => "x",
    } as never);
    expect(layout.items).toHaveLength(5);
  });
});

describe("spacing (spec worked example: layers [3, 8, 4, 1], defaults)", () => {
  const layout = layoutDenseNetwork({ layers: [3, 8, 4, 1] });

  it("places layers at x = 80, 240, 400, 560", () => {
    for (const [layerIndex, expectedX] of [80, 240, 400, 560].entries()) {
      for (const item of layerItems(layout, layerIndex)) {
        expectClose(item.x, expectedX);
      }
    }
  });

  it("places the 3-node layer at y = 60, 180, 300", () => {
    const ys = layerNodes(layout, 0).map((node) => node.y);
    expect(ys).toHaveLength(3);
    [60, 180, 300].forEach((expected, i) => expectClose(ys[i], expected));
  });

  it("places the 8-node layer with gap 45 starting at 22.5", () => {
    const ys = layerNodes(layout, 1).map((node) => node.y);
    expect(ys).toHaveLength(8);
    ys.forEach((y, i) => expectClose(y, 22.5 + 45 * i));
  });

  it("centers the single-node layer at y = 180", () => {
    const ys = layerNodes(layout, 3).map((node) => node.y);
    expect(ys).toHaveLength(1);
    expectClose(ys[0], 180);
  });

  it("derives nodeRadius from the smallest gap (45/8) and dot radius as a quarter of it", () => {
    expectClose(layout.nodeRadius, 5.625);
    expectClose(layout.ellipsisDotRadius, 1.40625);
  });
});

describe("spread parameters", () => {
  it("nodeSpread -1 pins outer nodes to the axis edges", () => {
    const layout = layoutDenseNetwork({ layers: [4, 2], nodeSpread: -1 });
    const ys = layerNodes(layout, 0).map((node) => node.y);
    [0, 120, 240, 360].forEach((expected, i) => expectClose(ys[i], expected));
  });

  it("nodeSpread +1 makes edge insets equal to inter-node gaps", () => {
    const layout = layoutDenseNetwork({ layers: [4, 2], nodeSpread: 1 });
    const ys = layerNodes(layout, 0).map((node) => node.y);
    [72, 144, 216, 288].forEach((expected, i) => expectClose(ys[i], expected));
  });

  it("layerSpread -1 pins outer layers to the axis edges", () => {
    const layout = layoutDenseNetwork({ layers: [2, 2, 2], layerSpread: -1 });
    const xs = [0, 1, 2].map((layerIndex) => layerNodes(layout, layerIndex)[0].x);
    [0, 320, 640].forEach((expected, i) => expectClose(xs[i], expected));
  });

  it("a single node with spread -1 is centered without dividing by zero", () => {
    const layout = layoutDenseNetwork({ layers: [1, 1], nodeSpread: -1 });
    for (const item of layout.items) {
      expectClose(item.y, 180);
      expect(Number.isFinite(item.x)).toBe(true);
    }
  });
});

describe("truncation (layers [100, 3], maxDisplayedNodes 6)", () => {
  const layout = layoutDenseNetwork({ layers: [100, 3], maxDisplayedNodes: 6 });
  const first = layerItems(layout, 0);

  it("lays the layer out as 7 slots: 0, 1, 2, ellipsis, 97, 98, 99", () => {
    expect(first).toHaveLength(7);
    expect(first.map((item) => (item.kind === "node" ? item.nodeIndex : "ellipsis"))).toEqual([
      0, 1, 2, "ellipsis", 97, 98, 99,
    ]);
    expect(first.map((item) => item.visibleIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("reports the omitted count on the central ellipsis", () => {
    const ellipsis = first[3] as LayoutEllipsisItem;
    expect(ellipsis.kind).toBe("ellipsis");
    expect(ellipsis.omittedCount).toBe(94);
    expectClose(ellipsis.y, 180); // central slot of 7
  });

  it("does not truncate at size == maxDisplayedNodes, does at size + 1", () => {
    const atLimit = layoutDenseNetwork({ layers: [6, 3], maxDisplayedNodes: 6 });
    expect(atLimit.items.filter((item) => item.kind === "ellipsis")).toHaveLength(0);

    const overLimit = layoutDenseNetwork({ layers: [7, 3], maxDisplayedNodes: 6 });
    const ellipses = overLimit.items.filter((item) => item.kind === "ellipsis");
    expect(ellipses).toHaveLength(1);
    expect((ellipses[0] as LayoutEllipsisItem).omittedCount).toBe(1);
  });

  it("uses displayed slot count (7) for the default radius", () => {
    // Layer 0 displays 7 slots: gap 360/7; layer 1 gap 120. Smallest wins.
    expectClose(layout.nodeRadius, 360 / 7 / 8);
  });
});

describe("items ordering", () => {
  it("orders items by layer, then visible slot position", () => {
    const layout = layoutDenseNetwork({ layers: [30, 2, 3], maxDisplayedNodes: 4 });
    const order = layout.items.map((item) => [item.layerIndex, item.visibleIndex]);
    const sorted = [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(order).toEqual(sorted);
  });
});

describe("edges", () => {
  it("fully connects adjacent layers: [3, 4] yields 12 ordered edges", () => {
    const layout = layoutDenseNetwork({ layers: [3, 4] });
    expect(layout.edges).toHaveLength(12);
    layout.edges.forEach((edge, i) => {
      expect(edge.edgeIndex).toBe(i);
      expect(edge.sourceNodeIndex).toBe(Math.floor(i / 4));
      expect(edge.targetNodeIndex).toBe(i % 4);
    });
  });

  it("numbers edges globally across layer pairs", () => {
    const layout = layoutDenseNetwork({ layers: [2, 3, 2] });
    expect(layout.edges).toHaveLength(6 + 6);
    expect(layout.edges.map((edge) => edge.edgeIndex)).toEqual([...Array(12).keys()]);
    expect(layout.edges.slice(0, 6).every((edge) => edge.sourceLayerIndex === 0)).toBe(true);
    expect(layout.edges.slice(6).every((edge) => edge.sourceLayerIndex === 1)).toBe(true);
  });

  it("connects only displayed real nodes in truncated layers", () => {
    const layout = layoutDenseNetwork({ layers: [100, 3], maxDisplayedNodes: 6 });
    expect(layout.edges).toHaveLength(6 * 3);
    const displayed = new Set([0, 1, 2, 97, 98, 99]);
    for (const edge of layout.edges) {
      expect(displayed.has(edge.sourceNodeIndex)).toBe(true);
    }
  });

  it("copies endpoint coordinates from the item positions", () => {
    const layout = layoutDenseNetwork({ layers: [3, 4, 2] });
    const nodeAt = new Map(
      layout.items
        .filter((item) => item.kind === "node")
        .map((item) => [`${item.layerIndex}:${item.nodeIndex}`, item]),
    );
    for (const edge of layout.edges) {
      const source = nodeAt.get(`${edge.sourceLayerIndex}:${edge.sourceNodeIndex}`)!;
      const target = nodeAt.get(`${edge.targetLayerIndex}:${edge.targetNodeIndex}`)!;
      expect([edge.x1, edge.y1]).toEqual([source.x, source.y]);
      expect([edge.x2, edge.y2]).toEqual([target.x, target.y]);
    }
  });
});

describe("default radii", () => {
  it("falls back to nodeAxisLength/25 when every layer has a single node", () => {
    const layout = layoutDenseNetwork({ layers: [1, 1, 1] });
    expectClose(layout.nodeRadius, 360 / 25);
    expectClose(layout.ellipsisDotRadius, 360 / 100);
  });

  it("passes explicit radii through", () => {
    const layout = layoutDenseNetwork({ layers: [3, 2], nodeRadius: 7 });
    expect(layout.nodeRadius).toBe(7);
    expect(layout.ellipsisDotRadius).toBe(1.75);

    const both = layoutDenseNetwork({ layers: [3, 2], nodeRadius: 7, ellipsisDotRadius: 3 });
    expect(both.ellipsisDotRadius).toBe(3);
  });
});

describe("vertical orientation", () => {
  it("is the exact transpose of the horizontal layout", () => {
    const horizontal = layoutDenseNetwork({
      layers: [3, 8, 4, 1],
      maxDisplayedNodes: 6,
      viewBox: { width: 640, height: 360 },
    });
    const vertical = layoutDenseNetwork({
      layers: [3, 8, 4, 1],
      maxDisplayedNodes: 6,
      orientation: "vertical",
      viewBox: { width: 360, height: 640 },
    });

    expect(vertical.items).toHaveLength(horizontal.items.length);
    horizontal.items.forEach((hItem, i) => {
      const vItem = vertical.items[i];
      expect(vItem.kind).toBe(hItem.kind);
      expect(vItem.x).toBe(hItem.y);
      expect(vItem.y).toBe(hItem.x);
    });

    horizontal.edges.forEach((hEdge, i) => {
      const vEdge = vertical.edges[i];
      expect([vEdge.x1, vEdge.y1, vEdge.x2, vEdge.y2]).toEqual([
        hEdge.y1,
        hEdge.x1,
        hEdge.y2,
        hEdge.x2,
      ]);
    });

    expect(vertical.nodeRadius).toBe(horizontal.nodeRadius);
  });

  it("stacks layers top to bottom at y = 80, 240, 400, 560 by default", () => {
    const layout = layoutDenseNetwork({ layers: [3, 8, 4, 1], orientation: "vertical" });
    for (const [layerIndex, expectedY] of [80, 240, 400, 560].entries()) {
      for (const item of layerItems(layout, layerIndex)) {
        expectClose(item.y, expectedY);
      }
    }
  });
});
