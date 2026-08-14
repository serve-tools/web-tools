import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
	isClipboardReadAvailable,
	isClipboardWriteAvailable,
	readFromClipboard,
	writeToClipboard,
} from "../src/lib/clipboard.js";

const globals = new Map<PropertyKey, PropertyDescriptor | undefined>();

const setGlobal = (key: PropertyKey, value: unknown): void => {
	globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
	Object.defineProperty(globalThis, key, { configurable: true, value });
};

beforeEach((): void => {
	setGlobal("isSecureContext", true);
});

afterEach((): void => {
	for (const [key, descriptor] of globals) {
		if (descriptor) {
			Object.defineProperty(globalThis, key, descriptor);
		} else {
			Reflect.deleteProperty(globalThis, key);
		}
	}

	globals.clear();
});

describe(writeToClipboard.name, (): void => {
	test("calls clipboard.write synchronously while representations remain pending", async (): Promise<void> => {
		let resolveData!: (value: string) => void;
		const data = new Promise<string>((resolve) => {
			resolveData = resolve;
		});
		const write = vi.fn(async (): Promise<void> => undefined);

		class FakeClipboardItem {
			constructor(readonly data: Record<string, unknown>) {}
		}

		setGlobal("ClipboardItem", FakeClipboardItem);
		setGlobal("navigator", { clipboard: { read: vi.fn(), write } });

		const result = writeToClipboard({ "text/plain": data });

		expect(write).toHaveBeenCalledTimes(1);
		expect(await result).toEqual({ status: "completed", value: undefined });

		resolveData("ready");
	});

	test("preserves write failures", async (): Promise<void> => {
		const error = new DOMException("Denied", "NotAllowedError");

		setGlobal("ClipboardItem", class {});
		setGlobal("navigator", { clipboard: { write: vi.fn().mockRejectedValue(error) } });

		await expect(writeToClipboard({ "text/plain": "test" })).resolves.toEqual({ status: "failed", error });
	});
});

describe(readFromClipboard.name, (): void => {
	test("returns clipboard items", async (): Promise<void> => {
		const items = [{}] as ClipboardItems;

		setGlobal("navigator", { clipboard: { read: vi.fn().mockResolvedValue(items) } });

		await expect(readFromClipboard()).resolves.toEqual({ status: "completed", value: items });
	});
});

test("reports read and write capabilities independently", (): void => {
	setGlobal("navigator", { clipboard: { read: vi.fn() } });
	setGlobal("ClipboardItem", undefined);

	expect(isClipboardReadAvailable()).toBe(true);
	expect(isClipboardWriteAvailable()).toBe(false);
});
