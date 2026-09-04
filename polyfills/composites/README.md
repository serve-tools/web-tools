# @serve-tools/polyfill-composites

The `@serve-tools/polyfill-composites` package installs the proposed `Composite` function when it is missing and preserves an existing native value.
Its fallback comes from [`@serve-tools/ponyfill-composites`](../../ponyfills/composites/).

```ts
import "@serve-tools/polyfill-composites";

const first = Composite({ x: 1, y: 4 });
const second = Composite({ y: 4, x: 1 });

first === second; // true with the bundled fallback
```

## Status

Composites is an experimental Stage 1 TC39 proposal whose design is expected to change.
The bundled `0.0.x` fallback has module-local rather than per-agent identity, allows composites in weak collections, and uses a linear live-registry search.
A selected native implementation can have different behavior from that fallback.
Do not use either interchangeably for stable persistence formats without reviewing the current proposal and package boundaries.

## Install

```shell
npm install @serve-tools/polyfill-composites
```

## Usage

Import the package before code that expects `globalThis.Composite` to exist.
The installed global is writable, configurable, and non-enumerable.
An existing non-null value and its descriptor are preserved without validation or repair, including an application sentinel.

Import the `./Composite` subpath to select the native function when available or the fallback otherwise without modifying the global environment:

```ts
import { Composite } from "@serve-tools/polyfill-composites/Composite";

const key = Composite({ account: "acct-42", region: "us-east-1" });
```

Import `@serve-tools/polyfill-composites/apply/Composite` when global installation should use the explicit selective entrypoint.
Use [`@serve-tools/ponyfill-composites`](../../ponyfills/composites/) directly when the documented module-local fallback or its exported `Composite`, `CompositeConstructor`, and `CompositeOptions` types are required regardless of native availability.

## Agent Skill

This package includes `skills/serve-tools-polyfill-composites/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-composites
npm test --workspace @serve-tools/polyfill-composites
npm run build --workspace @serve-tools/polyfill-composites
npm run check:package --workspace @serve-tools/polyfill-composites
```

## License

[MIT-0](./LICENSE.md)
