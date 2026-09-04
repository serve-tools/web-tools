import { Observable as fallback } from "@serve-tools/ponyfill-observable";

const nativeValue = Reflect.get(globalThis, "Observable");

/** The native Observable interface object when available, otherwise the cold fallback interface object. */
export const Observable: typeof fallback = nativeValue ?? fallback;
