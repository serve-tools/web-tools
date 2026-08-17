# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-report-error.recipes.ts` fixture in the package source.

```ts
import { reportError } from "@serve-tools/ponyfill-report-error";

/** Reports a failure through the module-scoped console-backed implementation. */
export const reportFailure = (error: unknown): void => reportError(error);
```
