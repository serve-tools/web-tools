import { reportError as fallback } from "@serve-tools/ponyfill-report-error";

const nativeValue = Reflect.get(globalThis, "reportError") as typeof fallback | undefined;

/** The native `reportError` function when available, otherwise the module-scoped ponyfill. */
export const reportError: typeof fallback = nativeValue ? nativeValue.bind(globalThis) : fallback;
