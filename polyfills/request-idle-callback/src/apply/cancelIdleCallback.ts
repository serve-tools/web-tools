import { cancelIdleCallback as value } from "../exports/cancelIdleCallback.js";

globalThis.cancelIdleCallback ?? (globalThis.cancelIdleCallback = value);

declare global {
	/** The native or installed function for cancelling scheduled idle work. */
	function cancelIdleCallback(handle: number): void;
}
