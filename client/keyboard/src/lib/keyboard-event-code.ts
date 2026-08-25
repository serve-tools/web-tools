/** Generated from the pinned W3C UI Events KeyboardEvent.code value tables. */
// Source: https://github.com/w3c/uievents-code/blob/b201684d1de0af90bc403814bbdee6aa96647130/index-source.txt
// Regenerate: npm run generate:keyboard-types --workspace @serve-tools/client-keyboard

/** Standardized physical keyboard code values. */
export type KeyboardEventCode =
	| KeyboardEventCode.Modifier
	| KeyboardEventCode.AlphanumericWritingSystem
	| KeyboardEventCode.AlphanumericFunctional1
	| KeyboardEventCode.AlphanumericFunctional2
	| KeyboardEventCode.Controlpad
	| KeyboardEventCode.Arrowpad
	| KeyboardEventCode.Numpad
	| KeyboardEventCode.Function
	| KeyboardEventCode.Media
	| KeyboardEventCode.LegacyModifier
	| KeyboardEventCode.LegacyProcess
	| KeyboardEventCode.LegacyEditing
	| KeyboardEventCode.International
	| KeyboardEventCode.Special;

export namespace KeyboardEventCode {
	/** Standardized code values in the Modifier category. */
	export type Modifier =
		| "AltLeft"
		| "AltRight"
		| "ControlLeft"
		| "ControlRight"
		| "MetaLeft"
		| "MetaRight"
		| "ShiftLeft"
		| "ShiftRight";

	/** Standardized code values in the AlphanumericWritingSystem category. */
	export type AlphanumericWritingSystem =
		| "Backquote"
		| "Backslash"
		| "BracketLeft"
		| "BracketRight"
		| "Comma"
		| "Digit0"
		| "Digit1"
		| "Digit2"
		| "Digit3"
		| "Digit4"
		| "Digit5"
		| "Digit6"
		| "Digit7"
		| "Digit8"
		| "Digit9"
		| "Equal"
		| "IntlBackslash"
		| "IntlRo"
		| "IntlYen"
		| "KeyA"
		| "KeyB"
		| "KeyC"
		| "KeyD"
		| "KeyE"
		| "KeyF"
		| "KeyG"
		| "KeyH"
		| "KeyI"
		| "KeyJ"
		| "KeyK"
		| "KeyL"
		| "KeyM"
		| "KeyN"
		| "KeyO"
		| "KeyP"
		| "KeyQ"
		| "KeyR"
		| "KeyS"
		| "KeyT"
		| "KeyU"
		| "KeyV"
		| "KeyW"
		| "KeyX"
		| "KeyY"
		| "KeyZ"
		| "Minus"
		| "Period"
		| "Quote"
		| "Semicolon"
		| "Slash";

	/** Standardized code values in the AlphanumericFunctional1 category. */
	export type AlphanumericFunctional1 = "Backspace" | "CapsLock" | "ContextMenu" | "Enter" | "Space" | "Tab";

	/** Standardized code values in the AlphanumericFunctional2 category. */
	export type AlphanumericFunctional2 =
		| "Convert"
		| "KanaMode"
		| "Lang1"
		| "Lang2"
		| "Lang3"
		| "Lang4"
		| "Lang5"
		| "NonConvert";

	/** Standardized code values in the Controlpad category. */
	export type Controlpad = "Delete" | "End" | "Help" | "Home" | "Insert" | "PageDown" | "PageUp";

	/** Standardized code values in the Arrowpad category. */
	export type Arrowpad = "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp";

	/** Standardized code values in the Numpad category. */
	export type Numpad =
		| "NumLock"
		| "Numpad0"
		| "Numpad1"
		| "Numpad2"
		| "Numpad3"
		| "Numpad4"
		| "Numpad5"
		| "Numpad6"
		| "Numpad7"
		| "Numpad8"
		| "Numpad9"
		| "NumpadAdd"
		| "NumpadBackspace"
		| "NumpadClear"
		| "NumpadClearEntry"
		| "NumpadComma"
		| "NumpadDecimal"
		| "NumpadDivide"
		| "NumpadEnter"
		| "NumpadEqual"
		| "NumpadHash"
		| "NumpadMemoryAdd"
		| "NumpadMemoryClear"
		| "NumpadMemoryRecall"
		| "NumpadMemoryStore"
		| "NumpadMemorySubtract"
		| "NumpadMultiply"
		| "NumpadParenLeft"
		| "NumpadParenRight"
		| "NumpadStar"
		| "NumpadSubtract";

	/** Standardized code values in the Function category. */
	export type Function =
		| "Escape"
		| "F1"
		| "F2"
		| "F3"
		| "F4"
		| "F5"
		| "F6"
		| "F7"
		| "F8"
		| "F9"
		| "F10"
		| "F11"
		| "F12"
		| "F13"
		| "F14"
		| "F15"
		| "F16"
		| "F17"
		| "F18"
		| "F19"
		| "F20"
		| "F21"
		| "F22"
		| "F23"
		| "F24"
		| "Fn"
		| "FnLock"
		| "PrintScreen"
		| "ScrollLock"
		| "Pause";

	/** Standardized code values in the Media category. */
	export type Media =
		| "BrowserBack"
		| "BrowserFavorites"
		| "BrowserForward"
		| "BrowserHome"
		| "BrowserRefresh"
		| "BrowserSearch"
		| "BrowserStop"
		| "Eject"
		| "LaunchApp1"
		| "LaunchApp2"
		| "LaunchMail"
		| "MediaPlayPause"
		| "MediaSelect"
		| "MediaStop"
		| "MediaTrackNext"
		| "MediaTrackPrevious"
		| "Power"
		| "Sleep"
		| "AudioVolumeDown"
		| "AudioVolumeMute"
		| "AudioVolumeUp"
		| "WakeUp";

	/** Standardized code values in the LegacyModifier category. */
	export type LegacyModifier = "Hyper" | "Super" | "Turbo";

	/** Standardized code values in the LegacyProcess category. */
	export type LegacyProcess = "Abort" | "Resume" | "Suspend";

	/** Standardized code values in the LegacyEditing category. */
	export type LegacyEditing = "Again" | "Copy" | "Cut" | "Find" | "Open" | "Paste" | "Props" | "Select" | "Undo";

	/** Standardized code values in the International category. */
	export type International = "Hiragana" | "Katakana";

	/** Standardized code values in the Special category. */
	export type Special = "Unidentified";
}
