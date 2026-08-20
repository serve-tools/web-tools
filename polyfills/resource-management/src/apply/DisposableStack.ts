import "./Symbol/dispose.js";
import "./SuppressedError.js";
import type { DisposableStackConstructor } from "../.internals.js";
import { DisposableStack as value } from "../exports/DisposableStack.js";

const nativeValue = value as DisposableStackConstructor<typeof Symbol.dispose>;

globalThis.DisposableStack ?? (globalThis.DisposableStack = nativeValue);

declare global {
	/** The native or installed synchronous disposable-stack constructor. */
	var DisposableStack: typeof globalThis extends { onmessage: any; DisposableStack: infer T }
		? T
		: typeof nativeValue;

	/** A synchronous stack of resources disposed in reverse registration order. */
	type DisposableStack = typeof globalThis extends { onmessage: any; DisposableStack: { new (args: any[]): infer T } }
		? T
		: InstanceType<typeof nativeValue>;
}
