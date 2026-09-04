import type { Observable as PonyfillObservable } from "@serve-tools/ponyfill-observable";
import { Observable as value } from "../exports/Observable.js";

Reflect.get(globalThis, "Observable") ??
	Object.defineProperty(globalThis, "Observable", {
		value,
		configurable: true,
		writable: true,
	});

declare global {
	/** A reusable recipe whose consumption starts an Observable execution. */
	interface Observable<T> extends PonyfillObservable<T> {}

	/** The native or installed Observable interface object. */
	var Observable: typeof PonyfillObservable;
}
