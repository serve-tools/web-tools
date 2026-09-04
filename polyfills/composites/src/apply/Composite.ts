import type { CompositeConstructor as PonyfillCompositeConstructor } from "@serve-tools/ponyfill-composites";
import { Composite as value } from "../exports/Composite.js";

Reflect.get(globalThis, "Composite") ??
	Object.defineProperty(globalThis, "Composite", {
		value,
		configurable: true,
		writable: true,
	});

declare global {
	/** The native or installed Composite function. */
	var Composite: PonyfillCompositeConstructor;
}
