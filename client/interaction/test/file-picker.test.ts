import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { isNativeFilePickerAvailable, openFiles } from "../src/lib/file-picker.js";

const pickerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "showOpenFilePicker");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");

beforeEach((): void => {
	Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
});

afterEach((): void => {
	if (pickerDescriptor) {
		Object.defineProperty(globalThis, "showOpenFilePicker", pickerDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "showOpenFilePicker");
	}

	if (secureContextDescriptor) {
		Object.defineProperty(globalThis, "isSecureContext", secureContextDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "isSecureContext");
	}
});

test("resolves native handles to files", async (): Promise<void> => {
	const file = new File(["hello"], "hello.txt", { type: "text/plain" });
	const showOpenFilePicker = vi.fn().mockResolvedValue([{ getFile: vi.fn().mockResolvedValue(file) }]);

	Object.defineProperty(globalThis, "showOpenFilePicker", { configurable: true, value: showOpenFilePicker });

	await expect(openFiles()).resolves.toEqual({ status: "completed", value: [file] });
	expect(isNativeFilePickerAvailable()).toBe(true);
});

test("treats native picker dismissal as an abort", async (): Promise<void> => {
	Object.defineProperty(globalThis, "showOpenFilePicker", {
		configurable: true,
		value: vi.fn().mockRejectedValue(new DOMException("Dismissed", "AbortError")),
	});

	await expect(openFiles()).resolves.toEqual({ status: "aborted" });
});
