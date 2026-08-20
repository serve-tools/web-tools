import { dispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/dispose";

/** The native `Symbol.dispose` when available, otherwise a module-scoped fallback symbol. */
export const dispose: SymbolConstructor extends { description: any; dispose: infer T } ? T : typeof value =
	Symbol.dispose || value;
