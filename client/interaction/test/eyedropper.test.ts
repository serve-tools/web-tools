import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { isEyeDropperApiAvailable, openEyeDropper } from "../src/lib/eyedropper.js";

const eyeDropperDescriptor = Object.getOwnPropertyDescriptor(globalThis, "EyeDropper");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");

beforeEach((): void => {
	Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
});

afterEach((): void => {
	if (eyeDropperDescriptor) {
		Object.defineProperty(globalThis, "EyeDropper", eyeDropperDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "EyeDropper");
	}

	if (secureContextDescriptor) {
		Object.defineProperty(globalThis, "isSecureContext", secureContextDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "isSecureContext");
	}
});

test("distinguishes selection, abortion, and failure", async (): Promise<void> => {
	const open = vi
		.fn()
		.mockResolvedValueOnce({ sRGBHex: "#aabbcc" })
		.mockRejectedValueOnce(new DOMException("Dismissed", "AbortError"));
	const error = new DOMException("Denied", "NotAllowedError");

	open.mockRejectedValueOnce(error);
	Object.defineProperty(globalThis, "EyeDropper", {
		configurable: true,
		value: class {
			open = open;
		},
	});

	await expect(openEyeDropper()).resolves.toEqual({ status: "completed", value: "#aabbcc" });
	await expect(openEyeDropper()).resolves.toEqual({ status: "aborted" });
	await expect(openEyeDropper()).resolves.toEqual({ status: "failed", error });
	expect(isEyeDropperApiAvailable()).toBe(true);
});

test("treats an explicit signal abort as an aborted interaction", async (): Promise<void> => {
	const controller = new AbortController();
	const reason = new Error("Stopped");

	controller.abort(reason);
	Object.defineProperty(globalThis, "EyeDropper", {
		configurable: true,
		value: class {
			open(): Promise<never> {
				return Promise.reject(reason);
			}
		},
	});

	await expect(openEyeDropper({ signal: controller.signal })).resolves.toEqual({ status: "aborted" });
});
