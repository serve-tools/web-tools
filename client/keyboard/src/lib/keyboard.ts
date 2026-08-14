import { isApplePlatform, isWindowsPlatform } from "./platform.js";

/** Represents the platform-specific modifier key: Command on Apple platforms, otherwise Control. */
export const modKey: KeyModifierProperty = isApplePlatform ? "metaKey" : "ctrlKey";

/** Represents the platform-specific auxiliary key: Control on Apple platforms, otherwise Meta. */
export const auxKey: KeyModifierProperty = isApplePlatform ? "ctrlKey" : "metaKey";

/** Returns whether the keyboard event exactly matches the given chord. */
export const matchKeyChord = (chord: KeyChord, event: KeyboardEvent): boolean => getKeyChord(event) === chord;

/** Returns the chord for a keyboard event, or an empty string when the event is not a valid chord. */
export const getKeyChord = (event: KeyboardEvent): KeyChord | "" => {
	const { key, keyCode } = event;

	if (
		keyCode === IgnorableKeyCode.Shift ||
		keyCode === IgnorableKeyCode.Control ||
		keyCode === IgnorableKeyCode.Alt ||
		key === "Meta"
	) {
		return "";
	}

	if (keyCode === IgnorableKeyCode.IME || event.isComposing) {
		return "";
	}

	if (event.getModifierState("AltGraph")) {
		return "";
	}

	const shortcut = (keyCodeMap[keyCode] ?? key) as KeyChordShortcut;
	const modPrefix = event[modKey] ? "Mod+" : "";
	const auxPrefix = event[auxKey] ? "Aux+" : "";
	const altPrefix = event.altKey ? "Alt+" : "";
	const shiftPrefix = event.shiftKey ? "Shift+" : "";

	return `${modPrefix}${auxPrefix}${altPrefix}${shiftPrefix}${shortcut}`;
};

/** Returns an accessible, platform-specific label for a key chord. */
export const getKeyChordLabel = (chord: KeyChord): string => {
	const parts = chord.split("+").map((part) => modifierLabelMap[part] ?? part);
	const size = parts.length;

	return size < 2
		? (parts[0] ?? "")
		: size === 2
			? `${parts[0]} and ${parts[1]}`
			: `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
};

/** Returns the platform-specific visual symbols for a key chord. */
export const getKeyChordSymbols = (chord: KeyChord): string[] =>
	chord.split("+").map((part) => modifierSymbolMap[part] ?? part);

/** Returns a platform-expanded value suitable for the `aria-keyshortcuts` attribute. */
export const getKeyChordAriaKeyShortcuts = (chord: KeyChord): string =>
	chord
		.split("+")
		.map((part) => ariaKeyMap[part] ?? part)
		.join("+");

const modifierLabelMap: Record<string, string> = {
	Mod: isApplePlatform ? "Command" : "Control",
	Aux: isApplePlatform ? "Control" : isWindowsPlatform ? "Windows" : "Super",
	Alt: isApplePlatform ? "Option" : "Alt",
	Shift: "Shift",
};

const modifierSymbolMap: Record<string, string> = {
	Alt: "⌥",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	Aux: isApplePlatform ? "⌃" : isWindowsPlatform ? "⊞" : "❖",
	Backspace: "⌫",
	Comma: ",",
	Enter: "⏎",
	Escape: "⎋",
	Minus: "−",
	Mod: isApplePlatform ? "⌘" : "⌃",
	Period: ".",
	Plus: "＋",
	Shift: "⇧",
	Space: "␣",
	Tab: "⇥",
};

const ariaKeyMap: Record<string, string> = {
	Mod: isApplePlatform ? "Meta" : "Control",
	Aux: isApplePlatform ? "Control" : "Meta",
	Comma: ",",
	Minus: "-",
	Period: ".",
};

const keyCodeMap: Record<number, string> = {
	9: "Tab",
	32: "Space",
	187: "Plus",
	188: "Comma",
	189: "Minus",
	190: "Period",
};

for (let i = 48; i <= 57; ++i) {
	keyCodeMap[i] = String.fromCharCode(i);
}

for (let i = 65; i <= 90; ++i) {
	keyCodeMap[i] = String.fromCharCode(i);
}

const enum IgnorableKeyCode {
	Shift = 16,
	Control = 17,
	Alt = 18,
	IME = 229,
}

// #region Types

/** A platform-relative keyboard chord emitted with canonical modifier ordering by `getKeyChord()`. */
export type KeyChord = `${KeyChordPrefix}${KeyChordShortcut}`;

/** A browser-standard, international, or future non-modifier `KeyboardEvent.key` value. */
export type KeyChordShortcut = string;

type KeyChordPrefix = `${"Mod+" | ""}${"Aux+" | ""}${"Alt+" | ""}${"Shift+" | ""}`;

type KeyModifierProperty = "ctrlKey" | "metaKey";

// #endregion Types
