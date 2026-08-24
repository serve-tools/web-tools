import type {
	IdleDeadline as PonyfillIdleDeadline,
	IdleRequestOptions as PonyfillIdleRequestOptions,
} from "@serve-tools/ponyfill-request-idle-callback";
import { requestIdleCallback as value } from "../exports/requestIdleCallback.js";

globalThis.requestIdleCallback ?? (globalThis.requestIdleCallback = value);

declare global {
	/** The deadline supplied to an idle callback. */
	interface IdleDeadline extends PonyfillIdleDeadline {}

	/** Options for scheduling an idle callback. */
	interface IdleRequestOptions extends PonyfillIdleRequestOptions {}

	/** A callback invoked during an idle period or after its timeout elapses. */
	interface IdleRequestCallback {
		/** Runs with the deadline for the current idle period. */
		(deadline: IdleDeadline): void;
	}

	/** The native or installed function for scheduling idle work. */
	function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number;
}
