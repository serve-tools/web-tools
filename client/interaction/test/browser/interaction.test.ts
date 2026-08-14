import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openFiles } from "../../src/lib/file-picker.js";

const pickerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "showOpenFilePicker");

beforeEach((): void => {
	Object.defineProperty(globalThis, "showOpenFilePicker", { configurable: true, value: undefined });
});

afterEach((): void => {
	vi.restoreAllMocks();

	if (pickerDescriptor) {
		Object.defineProperty(globalThis, "showOpenFilePicker", pickerDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "showOpenFilePicker");
	}
});

test("reports input picker cancellation as an abort", async (): Promise<void> => {
	vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement): void {
		this.dispatchEvent(new Event("cancel"));
	});

	await expect(openFiles()).resolves.toEqual({ status: "aborted" });
});

test("returns files selected through the input fallback", async (): Promise<void> => {
	const file = new File(["hello"], "hello.txt", { type: "text/plain" });

	vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement): void {
		Object.defineProperty(this, "files", { configurable: true, value: [file] });
		this.dispatchEvent(new Event("change"));
	});

	await expect(openFiles({ types: [{ accept: { "text/plain": [".txt"] } }] })).resolves.toEqual({
		status: "completed",
		value: [file],
	});
});
