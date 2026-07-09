# nnet-svg — Implementation and Testing Plan

Plan for implementing `DESIGN_SPEC.md`: a framework-independent TypeScript package that renders
a static dense feed-forward neural network as SVG.

## 1. Decisions (from spec + discussion)

| Topic | Decision |
|---|---|
| Package name | `nnet-svg` (confirmed available on npm as of 2026-07-09) |
| Package format | ESM-only + `.d.ts` declarations; no UMD/CJS |
| DOM construction | d3 micro-modules: `d3-selection` (regular dependency). `d3-transition`/`d3-ease` join later when animations land |
| Observable usage | CDN import: `import("https://esm.sh/nnet-svg")` in classic notebooks; `npm:nnet-svg` in Notebook Kit / Framework |
| Build | `tsc` only (no bundler) — ESM library with external deps needs no bundling |
| Tests | Vitest: pure layout unit tests (node env) + renderer DOM tests (jsdom env) |
| Visual checking | Manual demo HTML page; no automated visual regression |
| Repo / CI | git + GitHub; Actions CI on push/PR; automated npm publish on version tag |
| License | MIT |

## 2. Repository layout

```text
package.json
tsconfig.json
LICENSE
README.md
DESIGN_SPEC.md
PLAN.md
src/
  index.ts        # public re-exports only
  types.ts        # all public types (spec §25, §12, §13)
  validate.ts     # input validation (spec §5)
  layout.ts       # layoutDenseNetwork — pure, no DOM, no d3 (spec §8, §9, §12)
  renderSvg.ts    # createDenseNetworkSvg, renderDenseNetworkSvg (spec §3, §10–§24)
test/
  validate.test.ts
  layout.test.ts
  renderSvg.test.ts     # structure, ordering, classes, data-*, responsive
  callbacks.test.ts     # values, attrs, labels, titles, strict mode
  accessibility.test.ts # title/desc/role/aria, id generation
demo/
  index.html      # manual visual check page
.github/workflows/
  ci.yml
  release.yml
```

### package.json essentials

```jsonc
{
  "name": "nnet-svg",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "dependencies": { "d3-selection": "^3" },
  "devDependencies": { "typescript", "vitest", "jsdom", "@types/d3-selection" },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "demo": "npx serve .",          // demo page imports ../dist + esm.sh import map
    "prepublishOnly": "npm run test && npm run build"
  }
}
```

`tsconfig.json`: `target`/`lib` ES2020 + DOM, `module`/`moduleResolution` NodeNext, `strict: true`,
`declaration: true`, `outDir: dist`, `rootDir: src`.

## 3. Architecture notes

**`layout.ts` is pure.** No d3, no `document`. This is what makes the layout unit-testable in a
plain node environment and keeps `layoutDenseNetwork` usable by alternative renderers (spec §3.3).
It accepts the full options object and ignores rendering-only fields.

**Layout output** follows spec §12 (`viewBox`, `orientation`, `items`, `edges`) **plus** resolved
`nodeRadius` and `ellipsisDotRadius` fields, so the renderer and tests consume one source of truth
for all resolved geometry. (Spec §12 shows an "example shape"; these are additive.)

**`renderSvg.ts`** calls `layoutDenseNetwork` and then builds DOM with `d3-selection`'s
`create("svg")` / `.append()` / `.attr()`. Note `create()` uses the global `document`, hence jsdom
for renderer tests. Rendering is a single pass — no data joins needed for a static display, but
using d3 selections keeps the door open for joins/transitions later.

### Key algorithms

**Spacing (spec §8).** For N positions along axis length L with spread s:
- N > 1: `gap = L/(N+s)`, `inset = (1+s)/(N+s) * (L/2)`, position(i) = `inset + i*gap`
  (invariant: `2*inset + (N-1)*gap = L`).
- N = 1: position at `L/2`; never evaluate `L/(N+s)` (avoids N=1, s=-1).

Horizontal orientation: layers along x (L = viewBox.width), nodes along y (L = viewBox.height).
Vertical: swapped.

**Truncation (spec §9).** A layer with `size > maxDisplayedNodes` is laid out as
`maxDisplayedNodes + 1` slots; slot `m/2` (0-based center, m = maxDisplayedNodes) is the ellipsis;
slots before it hold true indices `0 … m/2 - 1`; slots after hold `size - m/2 … size - 1`.
`omittedCount = size - maxDisplayedNodes`.

**Default radii (spec §8).** `nodeRadius` = ⅛ of the smallest node gap among displayed layers with
more than one displayed slot; if every layer has a single displayed node, use `nodeAxisLength/25`.
`ellipsisDotRadius` = `nodeRadius/4`.

**Ellipsis glyph (spec §10).** `<g>` with three `<circle>` dots along the node-stack axis: center
dot at the slot center, outer dots at ±3×`ellipsisDotRadius` (≈ spans the node diameter).
*The ±3× spacing is not in the spec — chosen so the glyph visually occupies one node slot; refine
on the demo page.*

**Edges (spec §11).** For each adjacent layer pair, nested loop over displayed real nodes
(source visible order outer, target inner), skipping ellipsis slots; `edgeIndex` is a running
global counter. Emitted before nodes in the DOM via the group order.

### Renderer pipeline (order matters)

1. Validate options (throw on any §5 violation, regardless of `strict`).
2. Compute layout.
3. **Value pass** (spec §14): for every displayed node and edge, call `nodeValue`/`edgeValue`
   exactly once; cache in `Map<string, number>` keyed `"L:N"` for nodes and by `edgeIndex` for
   edges. Non-number (and non-null/undefined) results: `console.error` + treat as absent, or throw
   if `strict`. NaN/±Infinity are numbers — preserved.
4. Build datum objects (`NodeDatum`/`EdgeDatum` — semantic fields + cached `value`, no geometry).
5. Create root `<svg>`: default attrs → accessibility attrs → responsive attrs → user `svgAttrs`
   (`viewBox` never overridable; user `class` appended to `{prefix}-root`).
6. Append groups in order: `{prefix}-edges`, `{prefix}-items`, `{prefix}-labels`.
7. Edges: `<line>` + data-* + merged attrs + optional `<title>`.
8. Items: node `<circle>`s and ellipsis `<g>`s + data-* + merged attrs + optional `<title>`.
9. Labels: node labels at node centers, edge labels at edge midpoints, in the labels group.

**Callback safety (spec §24).** One helper wraps every user callback
(`nodeValue`, `edgeValue`, `*Attrs`, `*Label`, `*Title`): `strict: true` rethrows;
otherwise `console.error` and treat the result as absent.

**Attr merging (spec §15, §23).** `{...defaults, ...callbackResult}` with one exception: `class`
is appended to the generated class, never replaced.

**IDs (spec §20).** `idPrefix` used verbatim if provided; otherwise generate
`nn-<counter><random base36>` (module counter ensures uniqueness for multiple networks per page).
IDs only where required: top-level `<title>`/`<desc>` for `aria-labelledby`. Everything else uses
`data-*`.

**Accessibility (spec §18).** `role="img"`; `<title>` if `title` given; `<desc>` from `desc` or a
generated summary (layer sizes, orientation, truncation, `maxDisplayedNodes`); `aria-labelledby`
listing whichever of the two exist.

## 4. Implementation phases

Follows spec §27 order, grouped into commit-sized phases. Each phase lands with its tests.

- **Phase 0 — Scaffolding.** git init; package.json, tsconfig, vitest, LICENSE; empty module
  skeletons; CI workflow running typecheck + tests; first commit and GitHub repo.
- **Phase 1 — Types + validation.** `types.ts` in full; `validate.ts` covering every §5 rule with
  descriptive messages. Tests: `validate.test.ts`.
- **Phase 2 — Layout.** Horizontal orientation, spacing math, truncation/ellipsis slots, edges,
  default radii, then vertical orientation (a coordinate swap — cheap to do while the math is
  fresh; spec sequences it late but it costs little here). Tests: `layout.test.ts`.
- **Phase 3 — Core SVG rendering.** Root svg + responsive/fixed attrs, three groups, edge/node/
  ellipsis elements with default styling, classes, `data-*`. `renderDenseNetworkSvg` helper.
  Tests: `renderSvg.test.ts`. Demo page created here and kept current in later phases.
- **Phase 4 — Callbacks.** Value pass + caching, `nodeAttrs`/`edgeAttrs`, labels + label attrs,
  `<title>` tooltips. Tests: `callbacks.test.ts`.
- **Phase 5 — Accessibility + strict mode.** Top-level title/desc/aria, id generation, callback
  error handling paths. Tests: `accessibility.test.ts` + strict-mode cases in `callbacks.test.ts`.
- **Phase 6 — Package + release.** README (API docs, Observable usage recipes), demo polish,
  `npm pack` sanity check, v0.1.0 publish, verify the esm.sh import in a real Observable notebook.

## 5. Testing plan

Vitest throughout. Layout/validation tests declare `// @vitest-environment node` (proves no DOM
dependency); renderer tests use jsdom. CI runs the full suite on every push/PR.

### 5.1 Validation (`validate.test.ts`)

Every rule in spec §5, each asserting a thrown error with a message naming the bad option:
missing/short/non-integer/non-positive `layers`; odd, <2, or non-integer `maxDisplayedNodes`;
non-positive/non-finite `viewBox` dims; `nodeSpread`/`layerSpread` < −1 or non-finite; bad
`orientation`/`responsive`/`strict` types. Plus: valid inputs do not throw, and top-level
validation throws even when `strict: false`.

### 5.2 Layout (`layout.test.ts`) — exact-value assertions

- **Defaults:** viewBox 640×360 horizontal / 360×640 vertical; `maxDisplayedNodes` 12; spreads 0.
- **Spacing, worked example:** `layers: [3, 8, 4, 1]`, horizontal, defaults →
  layer x = 80, 240, 400, 560; layer-0 y = 60, 180, 300; layer-3 (N=1) y = 180 (centered).
- **Spread endpoints** (N=4, L=360): s=−1 → gap 120, positions 0/120/240/360 (pinned at edges);
  s=+1 → gap 72, positions 72/144/216/288 (edge insets equal gaps).
- **N=1 safety:** single node with spread −1 does not divide by zero; sits at L/2.
- **Truncation:** `layers: [100, 3]`, `maxDisplayedNodes: 6` → 7 slots; item order
  0,1,2,ellipsis,97,98,99 with true `nodeIndex` values; `omittedCount: 94`; ellipsis
  `visibleIndex: 3` at the center slot coordinate. Boundary: `size === maxDisplayedNodes` does
  not truncate; `size === maxDisplayedNodes + 1` does.
- **Items ordering:** by layer, then visible slot, across all layers.
- **Edges:** counts (untruncated `[3,4]` → 12; truncated `[100,3]`, max 6 → 18); ordering by
  layer pair → source visible order → target visible order; `edgeIndex` global and gapless;
  no edge touches an ellipsis; endpoint coordinates equal the corresponding item coordinates.
- **Default radii:** `[3, 8, 4, 1]` horizontal → min gap 45 (layer 1) → `nodeRadius` 5.625,
  `ellipsisDotRadius` 1.40625; radius computed from *displayed* slots when truncated;
  all-single-node network → `nodeAxisLength/25`; explicit `nodeRadius`/`ellipsisDotRadius`
  options pass through.
- **Vertical orientation:** same network vertical vs horizontal → coordinates swap axes exactly.
- **Options tolerance:** rendering-only options (labels, callbacks, `title`, …) are accepted and
  ignored (§3.3).

### 5.3 Renderer structure (`renderSvg.test.ts`, jsdom)

- Returns an `SVGSVGElement`; correct namespace.
- Root: `viewBox="0 0 W H"`; responsive mode → `width="100%"`, no `height`, `preserveAspectRatio`,
  max-width style; `responsive: false` → numeric `width`/`height`.
- Three groups in edges → items → labels order; edges live only in the edges group (paint order).
- Element counts match layout (lines, circles, one ellipsis `<g>` with 3 dot circles).
- Classes: every recommended class from §19; custom `classPrefix` renames all of them.
- `data-*`: nodes (`kind`, `layer-index`, true `node-index`), ellipsis (`kind`, `layer-index`,
  `omitted-count`), edges (all five indices) — spot-checked against a truncated network so true
  indices ≠ visible indices.
- Default styling attrs present (node fill/stroke, edge stroke-opacity, …).
- `svgAttrs`: merged onto root; `class` appended not replaced; `viewBox` cannot be overridden;
  `preserveAspectRatio` can be.
- `renderDenseNetworkSvg`: replaces container contents (pre-existing children gone), returns the
  same element it appended.

### 5.4 Callbacks (`callbacks.test.ts`, jsdom)

- **Values:** `nodeValue`/`edgeValue` spies called exactly once per displayed node/edge — the
  caching contract of §14; truncated layers → called only for displayed nodes; `value` visible to
  every later callback; NaN/±Infinity preserved; null/undefined → no value; string return →
  `console.error` (spied) + treated as absent.
- **Attrs:** callback attrs override defaults; `class` appends; null/undefined return → defaults
  untouched; edge attrs receive true indices and `value`.
- **Labels:** string/number rendered via `String(...)`; null/undefined → no `<text>` element;
  node labels positioned at node center, edge labels at edge midpoint (exact x/y); label attrs
  merge over label defaults; labels in the labels group (topmost).
- **Titles:** `nodeTitle`/`edgeTitle` → `<title>` child of the circle/line; null → none.
- **Strict mode:** each of the 10 callbacks throwing → `strict: false` logs via `console.error`
  and rendering completes (element count intact); `strict: true` → exception propagates.
  Non-number value return throws under strict.

### 5.5 Accessibility + IDs (`accessibility.test.ts`, jsdom)

- `role="img"` always; `title` option → `<title>` with generated id; default `<desc>` mentions
  layer sizes/orientation/truncation when `desc` omitted; explicit `desc` used verbatim;
  `aria-labelledby` references exactly the ids present.
- Two renders on one page → disjoint generated ids; explicit `idPrefix` used verbatim.

### 5.6 Manual visual check (`demo/index.html`)

Static page importing the built `dist/index.js` (import map pointing `d3-selection` at esm.sh),
rendering a grid of configurations side by side: the spec's minimal example, truncation, both
orientations, spread extremes (−1, 0, +1), single-node layers, labels + values + styling
callbacks, responsive vs fixed. Serve with `npm run demo`. This is the eyeball-check for
everything the DOM tests can't judge (ellipsis dot spacing, default styling taste).

## 6. CI and publishing

**`ci.yml`** — on push + PR: checkout, setup-node (Node 22, npm cache), `npm ci`,
`npm run typecheck`, `npm test`, `npm run build`.

**`release.yml`** — on push of tag `v*`: run the full CI steps, then
`npm publish --access public --provenance`.

Publish flow for v0.1.0:
1. `npm pack --dry-run` — verify only `dist/`, README, LICENSE ship.
2. First publish **manually** from the local machine (`npm publish --access public`) — creates
   the package so its settings page exists on npmjs.com.
3. Configure **trusted publishing** (GitHub Actions OIDC) in the npm package settings pointing at
   `release.yml` — no long-lived NPM_TOKEN secret needed for subsequent tagged releases.
4. Verify in Observable: `nn = import("https://esm.sh/nnet-svg@0.1")` then
   `nn.createDenseNetworkSvg({layers: [4, 16, 8, 2]})` as a cell value.

**README** must include: install + import for npm users, both Observable recipes (classic
notebook via esm.sh, Notebook Kit/Framework via `npm:`), full options reference, the §26 example,
a note that `layoutDenseNetwork` is an advanced API, and the `idPrefix` uniqueness caveat (§20).

## 7. Resolved spec ambiguities

Decisions made here where the spec is silent; revisit if any looks wrong:

1. **Ellipsis dot spacing:** outer dots at ±3×`ellipsisDotRadius` from center (spec fixes only
   the center dot and dot radius). Tune visually on the demo page.
2. **Layout output carries resolved `nodeRadius`/`ellipsisDotRadius`** in addition to §12 fields.
3. **Default radius with truncation** uses *displayed* slot gaps (truncated layers use
   `maxDisplayedNodes+1` slots), since that is the geometry actually drawn.
4. **Value cache keys:** `"layerIndex:nodeIndex"` for nodes, `edgeIndex` for edges.
5. **Ellipsis glyphs get no callbacks** (values/attrs/labels/titles are node/edge-only per §13);
   ellipsis styling is default-only for now, adjustable later via CSS classes.
6. **`svgAttrs.viewBox` is ignored** (the spec offers ignore-or-document; we do both).
