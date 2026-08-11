import { dispose as fallback } from "@serve-tools/ponyfill-resource-management/lib/Symbol/dispose";

const nativeValue = Reflect.get(Symbol, "dispose") as typeof fallback | undefined;

/** The native `Symbol.dispose` when available, otherwise a module-scoped fallback symbol. */
export const dispose: typeof fallback = nativeValue || fallback;
