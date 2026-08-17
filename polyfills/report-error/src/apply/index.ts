import { reportError as value } from "@serve-tools/ponyfill-report-error";

Reflect.get(globalThis, "reportError") ||
	Object.defineProperty(globalThis, "reportError", { value, configurable: true, writable: true });

declare global {
	/** Reports an error as an uncaught exception without interrupting the current operation. */
	function reportError(error: unknown): void;
}
