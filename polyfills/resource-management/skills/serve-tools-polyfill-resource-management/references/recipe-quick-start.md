# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-resource-management.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-resource-management";
import { DisposableStack } from "@serve-tools/polyfill-resource-management/DisposableStack";
import { dispose } from "@serve-tools/polyfill-resource-management/Symbol/dispose";

/** A compile-tested recipe for global installation and mutation-free imports. */
export function polyfillRecipe(): void {
	const events: string[] = [];
	const globalStack = new globalThis.DisposableStack();
	globalStack.defer(() => events.push("globally installed"));
	globalStack.dispose();

	const importedStack = new DisposableStack();
	importedStack.use({ [dispose]: () => events.push("module scoped") });
	importedStack[dispose]();
}
```
