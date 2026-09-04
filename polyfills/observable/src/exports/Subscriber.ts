import { Subscriber as fallback } from "@serve-tools/ponyfill-observable";

const nativeValue = Reflect.get(globalThis, "Subscriber");

/** The native Subscriber interface object when available, otherwise the fallback interface object. */
export const Subscriber: typeof fallback = nativeValue ?? fallback;
