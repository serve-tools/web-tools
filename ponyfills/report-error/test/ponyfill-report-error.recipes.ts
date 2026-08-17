import { reportError } from "../src/ponyfill-report-error.js";

/** Reports a failure through the module-scoped console-backed implementation. */
export const reportFailure = (error: unknown): void => reportError(error);
