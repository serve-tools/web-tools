import { cancelIdleCallback as value } from "../exports/cancelIdleCallback.js";

globalThis.cancelIdleCallback ||
	Object.defineProperty(globalThis, "cancelIdleCallback", { value, configurable: true, writable: true });

declare global {
	/** The native or installed function for cancelling scheduled idle work. */
	var cancelIdleCallback: typeof globalThis extends { onmessage: any; cancelIdleCallback: infer T }
		? T
		: typeof value;
}
