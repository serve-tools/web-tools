import { metadata as value } from "@serve-tools/ponyfill-decorator-metadata/lib/Symbol/metadata";

/** The native `Symbol.metadata` when available, otherwise a module-scoped fallback symbol. */
export const metadata: SymbolConstructor extends { description: any; metadata: infer T } ? T : typeof value =
	Symbol.metadata || value;
