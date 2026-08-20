import { reportError as value } from "@serve-tools/ponyfill-report-error";

globalThis.reportError ?? (globalThis.reportError = value);

declare global {
	/** Reports an error as an uncaught exception without interrupting the current operation. */
	function reportError(error: unknown): void;
}
