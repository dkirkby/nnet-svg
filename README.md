# nnet-svg

Render a dense feed-forward neural network as a static SVG.

> **Status: under development, not yet published.** See [DESIGN_SPEC.md](DESIGN_SPEC.md)
> for the full specification and [PLAN.md](PLAN.md) for the implementation plan.

## Planned usage

```js
import { createDenseNetworkSvg } from "nnet-svg";

const svg = createDenseNetworkSvg({
  layers: [4, 16, 8, 2],
  maxDisplayedNodes: 8,
});
document.body.append(svg);
```

In an Observable notebook:

```js
nn = import("https://esm.sh/nnet-svg")
```

```js
nn.createDenseNetworkSvg({ layers: [4, 16, 8, 2] })
```

## Development

```sh
npm install
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # emits ESM + .d.ts to dist/
npm run demo       # then open http://localhost:3000/demo/ (build first)
```

## License

MIT
