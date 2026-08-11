import "./Symbol/asyncDispose.js";
import "./Symbol/dispose.js";
import "./SuppressedError.js";
import type { AsyncDisposableStackConstructor } from "../.internals.js";
import { AsyncDisposableStack as value } from "../exports/AsyncDisposableStack.js";

const nativeValue = value as AsyncDisposableStackConstructor<typeof Symbol.asyncDispose, typeof Symbol.dispose>;

globalThis.AsyncDisposableStack ||
	Object.defineProperty(globalThis, "AsyncDisposableStack", {
		value: nativeValue,
		configurable: true,
		writable: true,
	});

declare global {
	/** The native or installed asynchronous disposable-stack constructor. */
	var AsyncDisposableStack: typeof globalThis extends { onmessage: any; AsyncDisposableStack: infer T }
		? T
		: typeof nativeValue;

	/** An asynchronous stack of resources disposed in reverse registration order. */
	type AsyncDisposableStack = typeof globalThis extends {
		onmessage: any;
		AsyncDisposableStack: { new (args: any[]): infer T };
	}
		? T
		: InstanceType<typeof nativeValue>;
}
