import { dispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/dispose";

Symbol.dispose || Object.defineProperty(Symbol, "dispose", { value });

declare global {
	interface SymbolConstructor {
		/** The well-known symbol used by synchronous disposal protocols. */
		readonly dispose: globalThis.SymbolConstructor extends { description: any; dispose: infer T }
			? T
			: typeof value;
	}
}
