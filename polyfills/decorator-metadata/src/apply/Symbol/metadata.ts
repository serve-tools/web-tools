import { metadata as value } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

Symbol.metadata || Object.defineProperty(Symbol, "metadata", { value });

declare global {
	interface SymbolConstructor {
		/** The well-known symbol used to expose decorator metadata on a class. */
		readonly metadata: globalThis.SymbolConstructor extends { description: any; metadata: infer T }
			? T
			: typeof value;
	}
}
