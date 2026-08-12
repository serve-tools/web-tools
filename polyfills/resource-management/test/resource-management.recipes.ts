import "../src/polyfill-resource-management.js";
import { DisposableStack } from "../src/exports/DisposableStack.js";
import { dispose } from "../src/exports/Symbol/dispose.js";

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
