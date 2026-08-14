import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { isShareApiAvailable, share } from "../src/lib/share.js";

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const secureContextDescriptor = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");

beforeEach((): void => {
	Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true });
});

afterEach((): void => {
	if (navigatorDescriptor) {
		Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "navigator");
	}

	if (secureContextDescriptor) {
		Object.defineProperty(globalThis, "isSecureContext", secureContextDescriptor);
	} else {
		Reflect.deleteProperty(globalThis, "isSecureContext");
	}
});

test("distinguishes completed, aborted, and failed shares", async (): Promise<void> => {
	const nativeShare = vi
		.fn()
		.mockResolvedValueOnce(undefined)
		.mockRejectedValueOnce(new DOMException("No target selected", "AbortError"));
	const error = new DOMException("Denied", "NotAllowedError");

	nativeShare.mockRejectedValueOnce(error);
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: { share: nativeShare },
	});

	await expect(share({ url: "https://example.com" })).resolves.toEqual({ status: "completed", value: undefined });
	await expect(share({ text: "Hello" })).resolves.toEqual({ status: "aborted" });
	await expect(share({ title: "Example" })).resolves.toEqual({ status: "failed", error });
	expect(isShareApiAvailable()).toBe(true);
});

test("reports an unavailable API as a failure", async (): Promise<void> => {
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

	const result = await share({ text: "Hello" });

	expect(result.status).toBe("failed");
	if (result.status === "failed") expect((result.error as DOMException).name).toBe("NotSupportedError");
});
