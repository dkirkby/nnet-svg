# Dense Neural Network SVG Renderer — Static Display Specification

## 1. Purpose

Implement a reusable JavaScript/TypeScript package for rendering a static visual display of a dense feed-forward neural network as SVG.

The package should be framework-independent. The core API should create and return a native `SVGSVGElement`, suitable for direct use in an Observable notebook, vanilla JavaScript, or embedding inside a React wrapper. React should not be a required dependency of the core package.

Animations and interactions are out of scope for the initial implementation, but the design should leave room for them later.

## 2. Core Concepts

The network is specified by an array of positive integer layer sizes:

```ts
layers: number[];
```

For example:

```ts
[3, 8, 4, 1]
```

represents a dense neural network with:

* 3 input nodes
* 8 hidden nodes
* 4 hidden nodes
* 1 output node

The renderer displays nodes as circles and draws straight-line edges between every displayed node in each adjacent pair of layers.

## 3. Public API

### 3.1 Primary SVG Factory

```ts
createDenseNetworkSvg(options: DenseNetworkSvgOptions): SVGSVGElement
```

Creates and returns a new `SVGSVGElement`.

This is the primary public API.

Example:

```ts
const svg = createDenseNetworkSvg({
  layers: [4, 16, 8, 2],
  maxDisplayedNodes: 8,
});
document.body.append(svg);
```

In Observable:

```js
createDenseNetworkSvg({
  layers: [4, 16, 8, 2],
  maxDisplayedNodes: 8
})
```

### 3.2 Mounting Convenience Helper

```ts
renderDenseNetworkSvg(
  container: Element,
  options: DenseNetworkSvgOptions
): SVGSVGElement
```

Creates an SVG using `createDenseNetworkSvg`, replaces the container contents with it, and returns the SVG.

Equivalent behavior:

```ts
const svg = createDenseNetworkSvg(options);
container.replaceChildren(svg);
return svg;
```

### 3.3 Advanced Layout API

```ts
layoutDenseNetwork(options: DenseNetworkLayoutOptions): DenseNetworkLayout
```

Computes the layout without creating SVG elements, consisting of resolved (x,y) placement and visibility decisions needed to draw the network without actually creating any SVG DOM elements.

This is a stable public API, but should be documented as an advanced/helper API for testing, debugging, or alternative renderers.

It should use the same options object as the SVG renderer, ignoring rendering-only options such as labels, titles, styling callbacks, and accessibility metadata.

## 4. Package Format

The package may be authored in TypeScript but should publish standard ESM JavaScript plus `.d.ts` declarations.

Recommended package structure:

```text
src/
  index.ts
  layout.ts
  renderSvg.ts
  types.ts
```

Core package should not depend on React.

An optional React wrapper may be added later as a separate subpath export, for example:

```ts
import { DenseNetworkSvg } from "dense-network-svg/react";
```

but this is not part of the initial static renderer requirement.

## 5. Input Validation

Top-level invalid inputs should always throw descriptive errors, regardless of `strict`.

Validation rules:

* `layers` is required.
* `layers.length >= 2`.
* Every layer size must be a positive integer.
* `maxDisplayedNodes` must be an even integer `>= 2`.
* `viewBox.width` and `viewBox.height`, if provided, must be positive finite numbers.
* `nodeSpread` and `layerSpread` must be finite numbers >= -1.
* `orientation`, if provided, must be `"horizontal"` or `"vertical"`.
* `responsive`, if provided, must be boolean.
* `strict`, if provided, must be boolean.

Callback errors are handled separately; see Section 14.

## 6. Layout Orientation

Support two orientations:

```ts
orientation?: "horizontal" | "vertical";
```

Default:

```ts
"horizontal"
```

Behavior:

* `"horizontal"`: layers flow left to right.
* `"vertical"`: layers flow top to bottom.

The orientation affects:

* layer placement direction
* node-stack direction
* ellipsis glyph orientation
* default `viewBox`

## 7. ViewBox and Responsive Rendering

The renderer should distinguish between internal SVG coordinates and rendered display size.

### 7.1 Internal Coordinate System

Use:

```ts
viewBox?: {
  width: number;
  height: number;
};
```

The `viewBox` controls the SVG coordinate system used for layout, node radii and font sizes.

Defaults:

```ts
orientation: "horizontal" -> { width: 640, height: 360 }
orientation: "vertical"   -> { width: 360, height: 640 }
```

### 7.2 Responsive Display

```ts
responsive?: boolean;
```

Default:

```ts
true
```

When `responsive: true`, generated SVG should use:

```html
<svg
  viewBox="0 0 W H"
  width="100%"
  preserveAspectRatio="xMidYMid meet"
  style="max-width: 100%; height: auto;"
>
```

The renderer should not set a fixed `height` attribute in responsive mode.

When `responsive: false`, generated SVG should use:

```html
<svg
  viewBox="0 0 W H"
  width="W"
  height="H"
  preserveAspectRatio="xMidYMid meet"
>
```

The node shapes must remain circles. This requires preserving aspect ratio and avoiding non-uniform scaling.

## 8. Automatic Spacing

Spacing should be computed automatically from:

* `viewBox`
* `orientation`
* `nodeSpread` and `layerSpread`
* `maxDisplayedNodes`
* number of layers

The spacing between nodes in a layer with N nodes along an axis of length L is L/(N+nodeSpread).
The inset of the first and last nodes is (1+nodeSpread)/(N+nodeSpread)*(L/2). The value of nodeSpread
should be >= -1, with -1 corresponding to nodes pinned at each edge (when N>1), and +1 producing the same size gaps between nodes
and at the edges.

The spacing between the N layers along an axis of length L is computed similarly but replacing nodeSpread with layerSpread.
Specifically, the gap between layers is L/(N+layerSpread) and the inset of the first and last layers is (1+layerSpread)/(N+layerSpread)*(L/2).

For both nodes and layers, L/(N+spread) should only be calculated when N>1. This is to avoid issues when N=1 and spread=-1.

Both spread parameters default to zero.

When nodeSpread equals -1 the outer nodes are pinned at the ends of the node axis, which would clip their circles at the viewBox boundary. To avoid this, the node axis is padded at each end with a margin equal to nodeRadius + nodeStrokeWidth/2 (the stroke is centered on the circle edge, so the drawn extent of a node is nodeRadius + nodeStrokeWidth/2): positions are computed over the reduced length L - 2*margin and then shifted by margin. The layer axis is padded the same way when layerSpread equals -1. No margin is applied for spread values greater than -1.

The default nodeRadius should be equal 1/8 of the smallest inter-node gap in the network. In case all layers have 1 node, use L/25.
The default ellipsisDotRadius should be 1/4 of nodeRadius.
The default nodeStrokeWidth is nodeRadius/8, clipped to a minimum of 0.75 viewBox units so strokes remain visible for small nodes.

The default nodeRadius is computed from the unpadded gaps, before any spread margin is applied (the margin depends on nodeRadius and nodeStrokeWidth, so both must be resolved first).

## 9. Node Truncation

Layers with more than `maxDisplayedNodes` actual nodes should be truncated with a layout calculated as if they have maxDisplayedNodes+1 nodes, with an ellipsis replacing the central node (maxDisplayedNodes is required to be even). The default maxDisplayedNodes is 12.

Example:

```ts
layers = [100, 3]
maxDisplayedNodes = 6
```

Visible first layer slots:

```text
0, 1, 2, ellipsis, 97, 98, 99
```

The visible real nodes preserve their true original node indices.

## 10. Ellipsis Glyph

The ellipsis should be rendered as a graphical glyph made from three small dots, not as SVG text. The ellipsis occupies the same amount of space as one node, with the central dot at the same center that a node would occupy.

The ellipsis should orient along the node-stack direction:

* In horizontal network orientation, layers are vertical columns, so the ellipsis dots should be arranged vertically.
* In vertical network orientation, layers are horizontal rows, so the ellipsis dots should be arranged horizontally.

Ellipsis slots:

* are not real nodes
* do not receive edges
* should have `kind: "ellipsis"` in layout output
* should include useful `data-*` attributes in SVG

## 11. Edges

Edges are always straight lines.

Use SVG `<line>` elements.

Edges connect every displayed real node in one layer to every displayed real node in the next adjacent layer.

Edges must not connect to ellipsis glyphs.

For truncated layers, edges should connect to the displayed first and last true nodes only.

Edges should be ordered by:

1. adjacent layer pair
2. source node visible order
3. target node visible order

Edges should be drawn before nodes so that nodes appear on top of connection lines.

## 12. Layout Output

`layoutDenseNetwork(...)` should return a layout object containing a unified `items` array and an `edges` array.

Example shape:

```ts
type DenseNetworkLayout = {
  viewBox: {
    width: number;
    height: number;
  };
  orientation: "horizontal" | "vertical";
  items: LayoutItem[];
  edges: LayoutEdge[];
};
```

### 12.1 Layout Items

Use a discriminated `kind` field:

```ts
type LayoutItem = LayoutNodeItem | LayoutEllipsisItem;
```

Node item:

```ts
type LayoutNodeItem = {
  kind: "node";
  layerIndex: number;
  nodeIndex: number;        // true index in original layer
  visibleIndex: number;     // slot index within visible layer
  x: number;
  y: number;
};
```

Ellipsis item:

```ts
type LayoutEllipsisItem = {
  kind: "ellipsis";
  layerIndex: number;
  visibleIndex: number;
  omittedCount: number;
  x: number;
  y: number;
};
```

Items should be ordered by:

1. layer index
2. visible slot position within the layer

For a truncated layer, item order should be:

```text
0, 1, 2, ellipsis, 97, 98, 99
```

### 12.2 Layout Edges

Edges should connect only real nodes.

```ts
type LayoutEdge = {
  sourceLayerIndex: number;
  sourceNodeIndex: number;   // true source node index
  targetLayerIndex: number;
  targetNodeIndex: number;   // true target node index
  edgeIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
```

The edgeIndex is global across the whole network.

Coordinates are exposed in the advanced layout API but should not be passed to ordinary styling and label callbacks.

## 13. Callback Data

Rendering callbacks should receive semantic datum objects, not raw layout geometry.

### 13.1 Node Datum

```ts
type NodeDatum = {
  kind: "node";
  layerIndex: number;
  nodeIndex: number;       // true node index
  value?: number;
};
```

### 13.2 Edge Datum

```ts
type EdgeDatum = {
  kind: "edge";
  sourceLayerIndex: number;
  sourceNodeIndex: number; // true source node index
  targetLayerIndex: number;
  targetNodeIndex: number; // true target node index
  edgeIndex: number;
  value?: number;
};
```

Callback data should use true original node indices, not display slot indices.

## 14. Values

Optional numeric values may be associated with nodes and edges.

```ts
nodeValue?: (node: NodeRef) => number | null | undefined;
edgeValue?: (edge: EdgeRef) => number | null | undefined;
```

At the beginning of createDenseNetworkSvg, the renderer must iterate through all visible nodes and edges, execute the nodeValue and edgeValue callbacks exactly once, and store the results in an internal lookup map. These cached values should be reused for all subsequent callbacks.

Rules:

* `undefined` means no value.
* `null` means no value.
* finite numbers are preserved.
* `NaN` is preserved.
* `Infinity` is preserved.
* `-Infinity` is preserved.
* non-number returns should trigger `console.error` and be treated as no value, unless `strict: true`.

Values are inert by default. They should not affect styling, labels, or titles unless the user supplies callbacks that use them.

## 15. Styling via Attribute Callbacks

Styling should be done primarily through SVG attribute callbacks, not CSS.

Use names ending in `Attrs`, not `Style`, because these callbacks return SVG attributes rather than CSS-only style objects.

```ts
nodeAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
edgeAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;
nodeLabelAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
edgeLabelAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;
```

Attribute merge rule:

```ts
finalAttrs = {
  ...defaultAttrs,
  ...callbackAttrs
};
```

Callback-supplied attributes override defaults.

If a callback supplies `class`, it should be appended to the generated default class, not replace it.

Default styling should be neutral and legible. Example defaults:

```ts
node:
  fill: "white"
  stroke: "currentColor"
  stroke-width: resolved nodeStrokeWidth (see Section 8)

edge:
  stroke: "currentColor"
  stroke-opacity: 0.25
  stroke-width: 1

label:
  fill: "currentColor"
  font-size: 10
  text-anchor: "middle"
  dominant-baseline: "middle"
  pointer-events: "none"
```

The exact numeric defaults may be refined during implementation.

## 16. Labels

Visible labels should be enabled at the individual node/edge level through callbacks.

```ts
nodeLabel?: (node: NodeDatum) => string | number | null | undefined;
edgeLabel?: (edge: EdgeDatum) => string | number | null | undefined;
```

Rules:

* `null` or `undefined` means no visible label.
* non-null label results are converted using `String(...)`.
* numeric rounding/formatting is the caller’s responsibility.

Example:

```ts
nodeLabel: node =>
  node.value === undefined ? null : node.value.toFixed(2)
```

Node labels should be centered inside node circles by default.

Edge labels should be centered at the edge midpoint by default.

Labels should be drawn above edges, nodes, and ellipsis glyphs.

Label positioning is handled automatically by the renderer. Label callbacks return only text content.

Label attribute callbacks control SVG text attributes only.

## 17. Native SVG Tooltips

Support optional native SVG tooltips via `<title>` elements for nodes and edges:

```ts
nodeTitle?: (node: NodeDatum) => string | null | undefined;
edgeTitle?: (edge: EdgeDatum) => string | null | undefined;
```

These are intended primarily as native browser tooltips and metadata, not as a full accessibility solution for interpreting individual neurons and edges.

## 18. SVG Accessibility

The SVG should be as accessible as reasonably possible at the graphic level.

Support top-level options:

```ts
title?: string;
desc?: string;
```

Behavior:

* If `title` is provided, create a top-level SVG `<title>`.
* If `desc` is provided, create a top-level SVG `<desc>`.
* If `desc` is omitted, generate a default description summarizing:

  * layer sizes
  * orientation
  * whether truncation is used
  * `maxDisplayedNodes`, if relevant
* Set `role="img"` on the root SVG.
* Use `aria-labelledby` when title and/or desc elements are present.

The renderer should not imply that individual nodes and edges have meaningful screen-reader semantics by default.

## 19. Classes

Generated elements should include predictable CSS classes as secondary metadata.

Default `classPrefix`:

```ts
classPrefix?: string; // default "dn"
```

Recommended classes:

```text
dn-root
dn-edges
dn-items
dn-labels
dn-edge
dn-node
dn-ellipsis
dn-ellipsis-dot
dn-node-label
dn-edge-label
```

CSS classes are not the primary styling mechanism. They exist for:

* debugging
* tests
* downstream post-processing
* future interaction support
* optional user CSS escape hatches

If user-supplied attributes include `class`, append the user class to the default class.

## 20. Generated IDs

The renderer should support multiple independent networks on the same page.

Use internally generated unique prefixes for any SVG IDs that are required, such as top-level title/desc IDs used by `aria-labelledby`.

Public option:

```ts
idPrefix?: string;
```

Rules:

* If omitted, generate a unique prefix internally.
* If provided, use it exactly.
* Document that the caller is responsible for uniqueness when providing `idPrefix`.

Avoid assigning SVG `id` attributes to every node and edge unless required. Prefer `data-*` attributes for inspectability and testing.

## 21. Data Attributes

Generated SVG elements should include deterministic `data-*` attributes by default.

### 21.1 Nodes

```html
<circle
  data-kind="node"
  data-layer-index="1"
  data-node-index="3"
/>
```

`data-node-index` must be the true original node index.

### 21.2 Ellipsis

```html
<g
  data-kind="ellipsis"
  data-layer-index="1"
  data-omitted-count="24"
/>
```

### 21.3 Edges

```html
<line
  data-kind="edge"
  data-source-layer-index="0"
  data-source-node-index="2"
  data-target-layer-index="1"
  data-target-node-index="7"
  data-edge-index="42"
/>
```

Source and target node indices must be true original indices.

## 22. SVG Drawing Order

The renderer should use grouped SVG structure and draw in this order:

```text
edges → nodes/ellipsis glyphs → labels
```

Recommended top-level groups:

```html
<g class="dn-edges">...</g>
<g class="dn-items">...</g>
<g class="dn-labels">...</g>
```

This ensures:

* edges appear behind nodes
* nodes appear above edges
* labels appear above both

## 23. Root SVG Attributes

Support:

```ts
svgAttrs?: SvgAttrs;
```

`svgAttrs` should be an object, not a callback.

Merge behavior:

```ts
finalSvgAttrs = {
  ...defaultSvgAttrs,
  ...accessibilityAttrs,
  ...responsiveAttrs,
  ...svgAttrs
};
```

Caveats:

* `viewBox` is controlled by `options.viewBox`.
* `svgAttrs.viewBox` should either be ignored or documented as unsupported.
* `preserveAspectRatio` defaults to `"xMidYMid meet"` but may be overridden intentionally.
* `svgAttrs.class` should be appended to the default root class, not replace it.

## 24. Error Handling

Support:

```ts
strict?: boolean;
```

Default:

```ts
false
```

Top-level invalid inputs should always throw.

Recoverable callback errors:

* In `strict: false`, catch exceptions, log to `console.error`, and continue rendering with that callback result treated as absent.
* In `strict: true`, rethrow callback exceptions immediately.

This should apply to:

* `nodeValue`
* `edgeValue`
* `nodeAttrs`
* `edgeAttrs`
* `nodeLabel`
* `edgeLabel`
* `nodeLabelAttrs`
* `edgeLabelAttrs`
* `nodeTitle`
* `edgeTitle`

Non-number returns from `nodeValue` or `edgeValue` should be logged and treated as no value in non-strict mode, and should throw in strict mode.

## 25. Suggested Type Definitions

```ts
type Orientation = "horizontal" | "vertical";

type ViewBox = {
  width: number;
  height: number;
};

type SvgAttrs = Record<string, string | number | boolean | null | undefined>;

type DenseNetworkLayoutOptions = {
  layers: number[];
  maxDisplayedNodes?: number;
  orientation?: Orientation;
  viewBox?: ViewBox;
  nodeSpread?: number;
  layerSpread?: number;
  nodeRadius?: number;
  ellipsisDotRadius?: number;
  nodeStrokeWidth?: number;
};

type DenseNetworkSvgOptions = DenseNetworkLayoutOptions & {
  responsive?: boolean;
  classPrefix?: string;
  idPrefix?: string;
  strict?: boolean;

  title?: string;
  desc?: string;

  svgAttrs?: SvgAttrs;

  nodeValue?: (node: NodeRef) => number | null | undefined;
  edgeValue?: (edge: EdgeRef) => number | null | undefined;

  nodeAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
  edgeAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;

  nodeLabel?: (node: NodeDatum) => string | number | null | undefined;
  edgeLabel?: (edge: EdgeDatum) => string | number | null | undefined;

  nodeLabelAttrs?: (node: NodeDatum) => SvgAttrs | null | undefined;
  edgeLabelAttrs?: (edge: EdgeDatum) => SvgAttrs | null | undefined;

  nodeTitle?: (node: NodeDatum) => string | null | undefined;
  edgeTitle?: (edge: EdgeDatum) => string | null | undefined;
};

type NodeRef = {
  kind: "node";
  layerIndex: number;
  nodeIndex: number;
};

type EdgeRef = {
  kind: "edge";
  sourceLayerIndex: number;
  sourceNodeIndex: number;
  targetLayerIndex: number;
  targetNodeIndex: number;
  edgeIndex: number;
};

type NodeDatum = NodeRef & {
  value?: number;
};

type EdgeDatum = EdgeRef & {
  value?: number;
};
```

## 26. Minimal Usage Example

```ts
const svg = createDenseNetworkSvg({
  layers: [3, 16, 8, 2],
  maxDisplayedNodes: 6,
  title: "Dense neural network",
  nodeValue: node =>
    activations[node.layerIndex]?.[node.nodeIndex],
  nodeLabel: node =>
    node.value === undefined ? null : node.value.toFixed(2),
  nodeAttrs: node => {
    if (node.value === undefined) return null;
    return {
      fill: node.value > 0 ? "white" : "#eee",
      stroke: "currentColor",
    };
  },
  edgeValue: edge =>
    weights[edge.sourceLayerIndex]?.[
      edge.sourceNodeIndex
    ]?.[
      edge.targetNodeIndex
    ],
  edgeAttrs: edge => {
    if (edge.value === undefined) return null;
    return {
      "stroke-width": Math.min(4, 1 + Math.abs(edge.value)),
      "stroke-opacity": 0.2,
    };
  },
});
```

## 27. Initial Implementation Priorities

Implement in this order:

1. Input validation.
2. Layout computation with horizontal orientation.
3. Truncation and ellipsis layout.
4. Edge generation between displayed real nodes.
5. SVG generation with drawing order groups.
6. Responsive root SVG behavior.
7. Classes and `data-*` attributes.
8. Node/edge value callbacks.
9. Attribute callbacks.
10. Labels.
11. Node/edge `<title>` tooltips.
12. Top-level accessibility metadata.
13. Vertical orientation.
14. Advanced `layoutDenseNetwork` export tests.
15. Error handling and `strict` mode.

## 28. Out of Scope for Initial Version

The following should not be implemented in the first static-display version:

* animation
* transitions
* hover styling
* click handlers
* drag behavior
* zoom/pan
* React-managed SVG rendering
* React dependency in the core package
* curved edges
* convolutional layers
* recurrent connections
* arbitrary graph topology
* edge connections to ellipsis glyphs
* built-in color scales or value-to-style mappings

The initial package should focus on producing a robust, deterministic, inspectable, accessible static SVG representation of a dense feed-forward network.
