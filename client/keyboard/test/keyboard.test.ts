import { describe, expect, test } from "vitest";

import {
	auxKey,
	getKeyChord,
	getKeyChordAriaKeyShortcuts,
	getKeyChordSymbols,
	matchKeyChord,
	modKey,
} from "../src/lib/keyboard.js";

const createKeyboardEvent = (
	key: string,
	keyCode = 0,
	init: Partial<KeyboardEvent> = {},
	altGraph = false,
): KeyboardEvent =>
	({
		key,
		keyCode,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		isComposing: false,
		getModifierState: (modifier: string): boolean => altGraph && modifier === "AltGraph",
		...init,
	}) as KeyboardEvent;

describe(getKeyChord.name, (): void => {
	test("uses keyCode before the modified or layout-dependent key value", (): void => {
		expect(getKeyChord(createKeyboardEvent("Dead", 90, { altKey: true }))).toBe("Alt+Z");
		expect(getKeyChord(createKeyboardEvent("<", 188, { shiftKey: true }))).toBe("Shift+Comma");
		expect(getKeyChord(createKeyboardEvent("k", 75))).toBe("K");
	});

	test("returns browser key values with modifiers in canonical order", (): void => {
		const modifiers = {
			[modKey]: true,
			[auxKey]: true,
			altKey: true,
			shiftKey: true,
		};

		expect(getKeyChord(createKeyboardEvent("k", 75, modifiers))).toBe("Mod+Aux+Alt+Shift+K");
		expect(getKeyChord(createKeyboardEvent("1", 49))).toBe("1");
		expect(getKeyChord(createKeyboardEvent("ArrowLeft"))).toBe("ArrowLeft");
		expect(getKeyChord(createKeyboardEvent("F12"))).toBe("F12");
		expect(getKeyChord(createKeyboardEvent("PageDown", 0, { [modKey]: true }))).toBe("Mod+PageDown");
		expect(getKeyChord(createKeyboardEvent("é"))).toBe("é");
	});

	test("returns an empty string for incomplete input", (): void => {
		expect(getKeyChord(createKeyboardEvent("Shift", 16))).toBe("");
		expect(getKeyChord(createKeyboardEvent("Unidentified", 229))).toBe("");
		expect(getKeyChord(createKeyboardEvent("K", 75, { isComposing: true }))).toBe("");
		expect(getKeyChord(createKeyboardEvent("K", 75, {}, true))).toBe("");
	});
});

describe(matchKeyChord.name, (): void => {
	test("matches the complete canonical chord", (): void => {
		const event = createKeyboardEvent("k", 75, { [modKey]: true });

		expect(matchKeyChord("Mod+K", event)).toBe(true);
		expect(matchKeyChord("Aux+K", event)).toBe(false);
	});
});

describe(getKeyChordSymbols.name, (): void => {
	test("returns symbols for supported non-platform keys", (): void => {
		expect(getKeyChordSymbols("Shift+Backspace")).toEqual(["⇧", "⌫"]);
		expect(getKeyChordSymbols("Comma")).toEqual([","]);
		expect(getKeyChordSymbols("Enter")).toEqual(["⏎"]);
		expect(getKeyChordSymbols("Escape")).toEqual(["⎋"]);
		expect(getKeyChordSymbols("Minus")).toEqual(["−"]);
		expect(getKeyChordSymbols("Period")).toEqual(["."]);
		expect(getKeyChordSymbols("Plus")).toEqual(["＋"]);
		expect(getKeyChordSymbols("Space")).toEqual(["␣"]);
		expect(getKeyChordSymbols("Tab")).toEqual(["⇥"]);
	});
});

test("expands platform-relative modifiers for aria-keyshortcuts", (): void => {
	const mod = modKey === "metaKey" ? "Meta" : "Control";
	const aux = auxKey === "metaKey" ? "Meta" : "Control";

	expect(getKeyChordAriaKeyShortcuts("Mod+Aux+Shift+K")).toBe(`${mod}+${aux}+Shift+K`);
});
