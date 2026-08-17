import { reportError } from "../src/polyfill-report-error.js";

/** Reports through the native platform function or the module-scoped ponyfill without mutating globals. */
export const reportFailure = (error: unknown): void => reportError(error);

/** Installs and calls the global only when application-level compatibility requires it. */
export async function applyReportError(error: unknown): Promise<void> {
	await import("../src/apply/index.js");
	reportError(error);
}
