import { asyncDispose as value } from "@serve-tools/ponyfill-resource-management/lib/Symbol/asyncDispose";

/** The native `Symbol.asyncDispose` when available, otherwise a module-scoped fallback symbol. */
export const asyncDispose: SymbolConstructor extends { description: any; asyncDispose: infer T } ? T : typeof value =
	Symbol.asyncDispose || value;
