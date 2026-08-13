import { AsyncDisposableStack, asyncDispose, DisposableStack, dispose } from "../src/ponyfill-resource-management.js";

/** A compile-tested recipe using the ponyfill's module-scoped symbols. */
export async function ponyfillRecipe(): Promise<void> {
	const events: string[] = [];
	const stack = new DisposableStack();
	stack.use({ [dispose]: () => events.push("disposed") });
	stack.defer(() => events.push("last in, first out"));
	stack.dispose();

	const asyncStack = new AsyncDisposableStack();
	asyncStack.use({ [asyncDispose]: async () => void events.push("disposed asynchronously") });
	await asyncStack.disposeAsync();
}
