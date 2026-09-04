# @serve-tools/ponyfill-composites

A dependency-free ponyfill for the Stage 1 TC39 [Composites proposal](https://github.com/tc39/proposal-composites).
Import it explicitly; it does not install a global or select a native implementation.

## Install

```shell
npm install @serve-tools/ponyfill-composites
```

#### Import from a CDN

```js
import * as ponyfillComposites from "https://esm.run/@serve-tools/ponyfill-composites";
```

## Status

This initial `0.0.x` line is experimental and follows an early-stage proposal whose design is expected to change.
It is suitable when the documented module-local identity and performance limits are acceptable, but it is not a stable substitute for a future native `Composite`.
Pin the package version and review the ponyfill boundaries before adopting it for persistent data formats or large registries.

```ts
import { Composite } from "@serve-tools/ponyfill-composites";

const first = Composite({ x: 1, y: 4 });
const last = Composite({ y: 4, x: 1 });

first === last; // true, because they are the same object

new Map([
	[last, "book"]
	// or [first, "book"]
]).get(
	last // or first
); // "book", because they are the same object
```

## Contract

`Composite(source, options?)` snapshots the source's own enumerable string-keyed properties.
It eagerly reads each value once, freezes the resulting null-prototype object, and interns equal key-value groups so input key order does not affect identity.
Enumerable symbol keys throw a `TypeError`; inherited and non-enumerable properties are ignored.

Values use `SameValue` after canonicalization: `NaN` values match, object values retain identity, and `-0` becomes `0` by default.
Pass `{ preserveNegativeZero: true }` to retain `-0` and distinguish it from `0`.
For a new composite, the option is read once before enumerating or reading source properties; passing an existing composite returns it without observing the options.
Immutability is shallow, so referenced objects remain mutable.

The generic `Composite<Source>` type approximates the source's string and numeric property shape as shallowly readonly, while omitting symbol keys and inherited Array members.
Flat object literals with primitive property values retain those literal values, so `Composite({ hello: "world" })` is inferred as `Composite<{ hello: "world" }>` without an `as const` assertion.
Other sources keep ordinary TypeScript inference so array literals remain arrays and inline nested objects retain their usual mutable types.
TypeScript cannot distinguish own enumerable properties from inherited or non-enumerable declarations, so class and built-in object shapes may still overstate the runtime result.
`Composite.isComposite(value)` narrows values created by this package.

## Ponyfill boundaries

The proposal is Stage 1 and explicitly expected to change.
This package follows the draft dated August 18, 2026 and will track later revisions.

Interning belongs to this module instance.
Two separately loaded copies do not share identity, and unlike a native per-agent implementation, this ponyfill cannot guarantee equality across realms.
JavaScript also cannot prevent these ordinary objects from being accepted by `WeakMap`, `WeakSet`, `WeakRef`, or `FinalizationRegistry`; the native proposal requires those operations to reject composites.
Interning searches the currently live composites linearly, so this initial ponyfill is intended for modest registries rather than workloads that continuously create large numbers of unique composites.

There is no global installer, native fallback, `Composite.of`, iterator, Record API, or Tuple API.

## Development

```shell
npm test --workspace @serve-tools/ponyfill-composites
npm run typecheck --workspace @serve-tools/ponyfill-composites
npm run build --workspace @serve-tools/ponyfill-composites
npm run check:package --workspace @serve-tools/ponyfill-composites
```

## License

[MIT-0](./LICENSE.md)
