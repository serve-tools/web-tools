import { reportError as _reportError } from "@serve-tools/ponyfill-report-error";

globalThis.reportError ?? (globalThis.reportError = _reportError);

declare global {
	/** Reports an error as an uncaught exception without interrupting the current operation. */
	function reportError(error: unknown): void;
}
