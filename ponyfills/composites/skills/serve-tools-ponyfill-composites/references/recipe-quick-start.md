# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-composites.recipes.ts` fixture in the package source.

```ts
import { Composite } from "@serve-tools/ponyfill-composites";

/** Uses an interned group of named values as a standard Map key. */
export const itemAtPosition = new Map([[Composite({ x: 1, y: 4 }), "book"]]);

export const item = itemAtPosition.get(Composite({ y: 4, x: 1 }));
```
