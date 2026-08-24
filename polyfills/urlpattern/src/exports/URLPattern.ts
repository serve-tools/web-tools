import { URLPattern as _URLPattern } from "@serve-tools/ponyfill-urlpattern";

/** The native `URLPattern` function when available, otherwise a module-scoped fallback. */
export const URLPattern: typeof globalThis.URLPattern = globalThis.URLPattern ?? _URLPattern;
