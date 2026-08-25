import { reportError as _reportError } from "@serve-tools/ponyfill-report-error";

/** The native `reportError` function when available, otherwise a module-scoped fallback. */
export const reportError: typeof globalThis extends { onmessage: any; reportError: infer T } ? T : typeof _reportError =
	globalThis.reportError ?? _reportError;
