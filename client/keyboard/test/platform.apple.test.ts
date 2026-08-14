import { afterAll, expect, test, vi } from "vitest";

const restoreNavigator = vi.hoisted(() => {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: { platform: "MacIntel" },
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

test("uses Apple platform conventions", (): void => {
	expect(isApplePlatform).toBe(true);
	expect(isWindowsPlatform).toBe(false);
	expect(modKey).toBe("metaKey");
	expect(auxKey).toBe("ctrlKey");
	expect(getKeyChordLabel("Mod+Aux+Alt+Shift+K")).toBe("Command, Control, Option, Shift, and K");
	expect(getKeyChordSymbols("Mod+Aux+Alt+Shift+K")).toEqual(["⌘", "⌃", "⌥", "⇧", "K"]);
	expect(getKeyChordAriaKeyShortcuts("Mod+Aux+K")).toBe("Meta+Control+K");
});
