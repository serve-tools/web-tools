import { asyncDispose as fallback } from "@serve-tools/ponyfill-resource-management/lib/Symbol/asyncDispose";

const nativeValue = Reflect.get(Symbol, "asyncDispose") as typeof fallback | undefined;

/** The native `Symbol.asyncDispose` when available, otherwise a module-scoped fallback symbol. */
export const asyncDispose: typeof fallback = nativeValue || fallback;
