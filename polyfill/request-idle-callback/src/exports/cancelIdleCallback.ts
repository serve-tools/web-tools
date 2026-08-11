import { cancelIdleCallback as fallback } from "@serve-tools/ponyfill-request-idle-callback";

const nativeValue = Reflect.get(globalThis, "cancelIdleCallback") as typeof fallback | undefined;

/** The native `cancelIdleCallback` function when available, otherwise a module-scoped fallback. */
export const cancelIdleCallback: typeof fallback = nativeValue ? nativeValue.bind(globalThis) : fallback;
