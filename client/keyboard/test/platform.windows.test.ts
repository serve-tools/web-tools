import { afterAll, expect, test, vi } from "vitest";

const restoreNavigator = vi.hoisted(() => {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: { platform: "Win32" },
	});

	return (): void => {
		if (descriptor) {
			Object.defineProperty(globalThis, "navigator", descriptor);
		} else {
			Reflect.deleteProperty(globalThis, "navigator");
		}
	};
});

import {
	auxKey,
	getKeyChordAriaKeyShortcuts,
	getKeyChordLabel,
	getKeyChordSymbols,
	modKey,
} from "../src/lib/keyboard.js";
import { isApplePlatform, isWindowsPlatform } from "../src/lib/platform.js";

afterAll(restoreNavigator);

test("uses Windows platform conventions", (): void => {
	expect(isApplePlatform).toBe(false);
	expect(isWindowsPlatform).toBe(true);
	expect(modKey).toBe("ctrlKey");
	expect(auxKey).toBe("metaKey");
	expect(getKeyChordLabel("Mod+Aux+Alt+Shift+K")).toBe("Control, Windows, Alt, Shift, and K");
	expect(getKeyChordSymbols("Mod+Aux+Alt+Shift+K")).toEqual(["⌃", "⊞", "⌥", "⇧", "K"]);
	expect(getKeyChordAriaKeyShortcuts("Mod+Aux+K")).toBe("Control+Meta+K");
});
