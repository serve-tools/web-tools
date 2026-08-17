# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-report-error.recipes.ts` fixture in the package source.

```ts
import { reportError } from "@serve-tools/polyfill-report-error";

/** Reports through the native platform function or the module-scoped ponyfill without mutating globals. */
export const reportFailure = (error: unknown): void => reportError(error);

/** Installs and calls the global only when application-level compatibility requires it. */
export async function applyReportError(error: unknown): Promise<void> {
	await import("@serve-tools/polyfill-report-error/apply");
	reportError(error);
}
```
