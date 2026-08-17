import { afterEach, describe, expect, it, vi } from "vitest";

import { reportError } from "../src/ponyfill-report-error.js";

afterEach(() => vi.restoreAllMocks());

describe("reportError", () => {
	it("reports through the console without consulting the global", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const nativeReportError = vi.fn();

		vi.stubGlobal("reportError", nativeReportError);
		reportError("failure");

		expect(consoleError).toHaveBeenCalledExactlyOnceWith("failure");
		expect(nativeReportError).not.toHaveBeenCalled();
	});
});
