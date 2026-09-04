# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-composites.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-composites";
import { Composite } from "@serve-tools/polyfill-composites/Composite";

/** Uses the native or installed Composite function as a stable Map key. */
export const positions = new Map([[Composite({ x: 1, y: 4 }), "book"]]);

export const item = positions.get(globalThis.Composite({ y: 4, x: 1 }));
```
