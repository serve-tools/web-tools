import { requestIdleCallback as fallback } from "@serve-tools/ponyfill-request-idle-callback";

const nativeValue = Reflect.get(globalThis, "requestIdleCallback") as typeof fallback | undefined;

/** The native `requestIdleCallback` function when available, otherwise a module-scoped fallback. */
export const requestIdleCallback: typeof fallback = nativeValue ? nativeValue.bind(globalThis) : fallback;
