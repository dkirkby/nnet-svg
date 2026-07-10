# nnet-svg

[![CI](https://github.com/dkirkby/nnet-svg/actions/workflows/ci.yml/badge.svg)](https://github.com/dkirkby/nnet-svg/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/nnet-svg)](https://www.npmjs.com/package/nnet-svg)

Render a dense feed-forward neural network as a static, accessible, inspectable SVG.

- **Framework-independent**: returns a native `SVGSVGElement`; works in vanilla JS,
  Observable notebooks, or wrapped by React/Vue/etc.
- **Automatic layout**: spacing, node radii, and stroke widths derived from the
  viewBox; large layers truncate around an ellipsis glyph.
- **Data-driven styling**: attach numeric values to nodes/edges once, then style,
  label, and tooltip them through callbacks.
- **Deterministic and testable**: predictable classes and `data-*` attributes,
  and a pure layout API with no DOM dependency.

## Install

```sh
npm install nnet-svg
```

## Quick start

```js
import { createDenseNetworkSvg } from "nnet-svg";

const svg = createDenseNetworkSvg({
  layers: [4, 16, 8, 2],
  maxDisplayedNodes: 8,
});
document.body.append(svg);
```

### Observable

In a classic notebook cell, import from a CDN:

```js
nn = import("https://esm.sh/nnet-svg@0.1")
```

```js
nn.createDenseNetworkSvg({ layers: [4, 16, 8, 2], maxDisplayedNodes: 8 })
```

In Observable Framework or Notebook Kit:

```js
import { createDenseNetworkSvg } from "npm:nnet-svg";
```

### Plain HTML

```html
<script type="importmap">
  { "imports": { "nnet-svg": "https://esm.sh/nnet-svg@0.1" } }
</script>
<script type="module">
  import { createDenseNetworkSvg } from "nnet-svg";
  document.body.append(createDenseNetworkSvg({ layers: [3, 8, 4, 1] }));
</script>
```

## API

### `createDenseNetworkSvg(options): SVGSVGElement`

Creates and returns a new SVG element displaying the network. The primary API.

### `renderDenseNetworkSvg(container, options): SVGSVGElement`

Convenience helper: creates the SVG, replaces `container`'s contents with it,
and returns it.

### `layoutDenseNetwork(options): DenseNetworkLayout`

**Advanced.** Computes node/ellipsis placement and edge geometry without
creating any DOM — useful for testing, debugging, or alternative renderers.
Accepts the same options object as the SVG APIs (rendering-only options are
ignored) and returns `{ viewBox, orientation, items, edges, nodeRadius,
ellipsisDotRadius, nodeStrokeWidth, edgeLabelPos }`, where `items` mixes
`kind: "node"` and `kind: "ellipsis"` entries in drawing order.

## Options

### Network and layout

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `layers` | `number[]` | required | Layer sizes, e.g. `[3, 8, 4, 1]`; at least 2 positive integers. |
| `maxDisplayedNodes` | `number` | `12` | Even integer ≥ 2. Larger layers are truncated around a central ellipsis; displayed nodes keep their true indices. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Layer flow direction. |
| `viewBox` | `{ width, height }` | `640×360` (horizontal), `360×640` (vertical) | Internal coordinate system for layout, radii, and font sizes. |
| `nodeSpread` | `number` | `0` | Node-stack spacing shape, ≥ −1. `-1` pins outer nodes to the padded axis ends; `+1` makes edge insets equal inter-node gaps. |
| `layerSpread` | `number` | `0` | Same, for layer placement. |
| `nodeRadius` | `number` | ⅛ of smallest node gap | Node circle radius. |
| `ellipsisDotRadius` | `number` | `nodeRadius / 4` | Radius of the three ellipsis dots. |
| `nodeStrokeWidth` | `number` | `max(nodeRadius / 8, 0.75)` | Node circle stroke width; `0` disables the stroke. |
| `edgeLabelPos` | `number` | `0.4` | Fractional position of edge labels along the edge from source (0) to target (1). `0.5` is the exact midpoint, where symmetric labels can overlap. |

### Rendering

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `responsive` | `boolean` | `true` | Scale to container width (`width="100%"`, no fixed height). When `false`, fixed pixel `width`/`height` from the viewBox. |
| `classPrefix` | `string` | `"dn"` | Prefix for generated CSS classes (`dn-root`, `dn-node`, `dn-edge`, …). |
| `idPrefix` | `string` | generated | Prefix for the title/desc ids. **If you provide it, you are responsible for uniqueness within the page.** |
| `strict` | `boolean` | `false` | When `true`, callback errors and invalid callback results throw; otherwise they log to `console.error` and rendering continues. |
| `title` | `string` | — | Accessible top-level SVG `<title>`. |
| `desc` | `string` | generated summary | Accessible top-level SVG `<desc>`. |
| `svgAttrs` | `object` | — | Extra attributes merged onto the root `<svg>`. `class` is appended to the generated class; `viewBox` is **ignored** (it is controlled by `options.viewBox` only). |

### Callbacks

All callbacks receive semantic datum objects with **true original node indices**
(never display-slot indices or coordinates). Returning `null`/`undefined` means
"nothing" everywhere.

| Option | Signature | Purpose |
| --- | --- | --- |
| `nodeValue` / `edgeValue` | `(ref) => number \| null \| undefined` | Attach a numeric value. Called **exactly once** per visible node/edge; results are cached and exposed as `datum.value` to all callbacks below. `NaN` and `±Infinity` are preserved; non-numbers are logged and ignored (throw when `strict`). |
| `nodeAttrs` / `edgeAttrs` | `(datum) => attrs` | SVG attributes merged over the defaults (callback wins; `class` is appended). |
| `nodeLabel` / `edgeLabel` | `(datum) => string \| number \| null` | Visible label text, converted with `String(...)`. Node labels center in the circle; edge labels sit at `edgeLabelPos` along the edge. |
| `nodeLabelAttrs` / `edgeLabelAttrs` | `(datum) => attrs` | Attributes for the label `<text>` elements (only called when a label rendered). |
| `nodeTitle` / `edgeTitle` | `(datum) => string \| null` | Native browser tooltip via a `<title>` child. |

### Example

```js
const svg = createDenseNetworkSvg({
  layers: [3, 16, 8, 2],
  maxDisplayedNodes: 6,
  title: "Dense neural network",
  nodeValue: (node) => activations[node.layerIndex]?.[node.nodeIndex],
  nodeLabel: (node) => (node.value === undefined ? null : node.value.toFixed(2)),
  nodeAttrs: (node) =>
    node.value === undefined ? null : { fill: node.value > 0 ? "white" : "#eee" },
  edgeValue: (edge) =>
    weights[edge.sourceLayerIndex]?.[edge.sourceNodeIndex]?.[edge.targetNodeIndex],
  edgeAttrs: (edge) =>
    edge.value === undefined
      ? null
      : { "stroke-width": Math.min(4, 1 + Math.abs(edge.value)) },
});
```

## Generated structure

The SVG is grouped in drawing order — edges, then nodes/ellipses, then labels —
so nodes always sit above edges and labels above both:

```html
<svg class="dn-root" role="img" aria-labelledby="…">
  <title>…</title>   <!-- when the title option is given -->
  <desc>…</desc>     <!-- always: user-provided or generated -->
  <g class="dn-edges">…</g>
  <g class="dn-items">…</g>
  <g class="dn-labels">…</g>
</svg>
```

Every element carries deterministic `data-*` attributes with true indices
(`data-layer-index`, `data-node-index`, `data-edge-index`,
`data-omitted-count`, …) for inspection, testing, and post-processing. CSS
classes are secondary metadata; styling is intended to flow through the attr
callbacks.

## Development

```sh
npm install
npm test           # vitest (layout unit tests + jsdom DOM tests)
npm run typecheck  # tsc --noEmit
npm run build      # emits ESM + .d.ts to dist/
npm run demo       # then open http://localhost:3000/demo/ (build first)
```

### Releasing

```sh
npm version patch   # or: minor / major — bumps package.json and creates the git tag
git push --follow-tags
```

The [Release workflow](.github/workflows/release.yml) runs on the `v*` tag:
typecheck, tests, and build, then `npm publish` authenticated via npm trusted
publishing (OIDC, no stored token) with provenance attached. It verifies that
the tag matches the package version and skips publishing if that version is
already on npm.

See [DESIGN_SPEC.md](DESIGN_SPEC.md) for the full specification.

## License

MIT
