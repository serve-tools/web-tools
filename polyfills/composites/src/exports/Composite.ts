import { Composite as fallback } from "@serve-tools/ponyfill-composites";

const nativeValue = Reflect.get(globalThis, "Composite");

/** The native Composite function when available, otherwise the module-scoped fallback. */
export const Composite: typeof fallback = nativeValue ?? fallback;
