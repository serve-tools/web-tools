import { SuppressedError as fallback } from "@serve-tools/ponyfill-resource-management/lib/SuppressedError";

const nativeValue = Reflect.get(globalThis, "SuppressedError") as typeof fallback | undefined;

/** The native `SuppressedError` constructor when available, otherwise a module-scoped fallback. */
export const SuppressedError: typeof fallback = nativeValue || fallback;
