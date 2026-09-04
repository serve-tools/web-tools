import type { Subscriber as PonyfillSubscriber } from "@serve-tools/ponyfill-observable";
import { Subscriber as value } from "../exports/Subscriber.js";

Reflect.get(globalThis, "Subscriber") ??
	Object.defineProperty(globalThis, "Subscriber", {
		value,
		configurable: true,
		writable: true,
	});

declare global {
	/** One active Observable execution and its cleanup boundary. */
	interface Subscriber<T = any> extends PonyfillSubscriber<T> {}

	/** The native or installed Subscriber interface object. */
	var Subscriber: typeof PonyfillSubscriber;
}
