# Recipe: quick start

This public-import example is generated from the compile-checked `test/rolldown-decorators.recipes.ts` fixture in the package source.

```ts
import { rolldownDecorators } from "@serve-tools/rolldown-decorators";

/** Transform modern TC39 decorators before Rolldown or Vite lowers application syntax. */
export const decoratorsPlugin = rolldownDecorators();
```
