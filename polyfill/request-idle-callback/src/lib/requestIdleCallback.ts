import type {
	IdleDeadline as PonyfillIdleDeadline,
	IdleRequestOptions as PonyfillIdleRequestOptions,
} from "@serve-tools/ponyfill-request-idle-callback";
import { requestIdleCallback as value } from "../exports/requestIdleCallback.js";

globalThis.requestIdleCallback ||
	Object.defineProperty(globalThis, "requestIdleCallback", { value, configurable: true, writable: true });

declare global {
	/** The deadline supplied to an idle callback. */
	interface IdleDeadline extends PonyfillIdleDeadline {}

	/** Options for scheduling an idle callback. */
	interface IdleRequestOptions extends PonyfillIdleRequestOptions {}

	/** A callback invoked during an idle period or after its timeout elapses. */
	interface IdleRequestCallback {
		(deadline: IdleDeadline): void;
	}

	/** The native or installed function for scheduling idle work. */
	var requestIdleCallback: typeof globalThis extends { onmessage: any; requestIdleCallback: infer T }
		? T
		: typeof value;
}
