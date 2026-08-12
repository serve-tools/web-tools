import { asyncDispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/asyncDispose";

Symbol.asyncDispose || Object.defineProperty(Symbol, "asyncDispose", { value });

declare global {
	interface SymbolConstructor {
		/** The well-known symbol used by asynchronous disposal protocols. */
		readonly asyncDispose: globalThis.SymbolConstructor extends { description: any; asyncDispose: infer T }
			? T
			: typeof value;
	}
}
