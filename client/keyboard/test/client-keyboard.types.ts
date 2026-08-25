import type {
	KeyboardEventCode,
	KeyboardEventKey,
	KeyChord,
	KeyChordShortcut,
	KnownKeyboardEventKey,
	KnownKeyChord,
	KnownKeyChordShortcut,
} from "../src/client-keyboard.js";
import {
	auxKey,
	getKeyChord,
	getKeyChordAriaKeyShortcuts,
	getKeyChordLabel,
	getKeyChordSymbols,
	matchKeyChord,
	modKey,
} from "../src/client-keyboard.js";

const physicalCodes: KeyboardEventCode[] = [
	"ShiftLeft" satisfies KeyboardEventCode.Modifier,
	"IntlYen" satisfies KeyboardEventCode.AlphanumericWritingSystem,
	"KeyA" satisfies KeyboardEventCode.AlphanumericWritingSystem,
	"Enter" satisfies KeyboardEventCode.AlphanumericFunctional1,
	"KanaMode" satisfies KeyboardEventCode.AlphanumericFunctional2,
	"PageDown" satisfies KeyboardEventCode.Controlpad,
	"ArrowUp" satisfies KeyboardEventCode.Arrowpad,
	"NumpadDecimal" satisfies KeyboardEventCode.Numpad,
	"F24" satisfies KeyboardEventCode.Function,
	"MediaTrackNext" satisfies KeyboardEventCode.Media,
	"Hyper" satisfies KeyboardEventCode.LegacyModifier,
	"Abort" satisfies KeyboardEventCode.LegacyProcess,
	"Paste" satisfies KeyboardEventCode.LegacyEditing,
	"Hiragana" satisfies KeyboardEventCode.International,
	"Unidentified" satisfies KeyboardEventCode.Special,
];

// @ts-expect-error physical keyboard codes are a closed standardized union
const unknownPhysicalCode: KeyboardEventCode = "KeyImaginary";

// @ts-expect-error physical keyboard code categories exclude unrelated standardized codes
const invalidPhysicalModifierCategory: KeyboardEventCode.Modifier = "KeyA";

const knownKeys: KnownKeyboardEventKey[] = [
	"Unidentified" satisfies KeyboardEventKey.General,
	"AltGraph",
	"Super" satisfies KeyboardEventKey.ModifierLegacy,
	"Enter" satisfies KeyboardEventKey.Whitespace,
	"ArrowLeft" satisfies KeyboardEventKey.Navigation,
	"Backspace" satisfies KeyboardEventKey.Editing,
	"Escape" satisfies KeyboardEventKey.Ui,
	"BrightnessUp" satisfies KeyboardEventKey.Device,
	"Dead" satisfies KeyboardEventKey.Composition,
	"HangulMode" satisfies KeyboardEventKey.ImeKorean,
	"Hiragana" satisfies KeyboardEventKey.ImeJapanese,
	"F24" satisfies KeyboardEventKey.Function,
	"MediaPlayPause" satisfies KeyboardEventKey.Multimedia,
	"Key11" satisfies KeyboardEventKey.MultimediaNumpad,
	"AudioVolumeUp" satisfies KeyboardEventKey.Audio,
	"SpeechInputToggle" satisfies KeyboardEventKey.Speech,
	"LaunchMail" satisfies KeyboardEventKey.Apps,
	"BrowserBack" satisfies KeyboardEventKey.Browser,
	"Camera" satisfies KeyboardEventKey.MobilePhone,
	"TVPower" satisfies KeyboardEventKey.Tv,
	"Guide" satisfies KeyboardEventKey.MediaController,
	"AudioVolumeUp" satisfies KeyboardEventKey.MediaControllerDup,
];

// @ts-expect-error known named keyboard keys exclude printable characters
const printableKnownKey: KnownKeyboardEventKey = "é";

// @ts-expect-error a printable space is not a standardized named keyboard key
const printableKnownSpaceKey: KnownKeyboardEventKey = " ";

// @ts-expect-error whitespace key names exclude printable space characters
const printableWhitespaceKey: KeyboardEventKey.Whitespace = " ";

// @ts-expect-error known named keyboard keys reject unknown future values
const unknownKnownKey: KnownKeyboardEventKey = "FutureKeyboardAction";

const modifierKey: KeyboardEventKey.Modifier = "AltGraph";
const navigationKey: KeyboardEventKey.Navigation = "PageDown";
const editingKey: KeyboardEventKey.Editing = "Backspace";
const functionKey: KeyboardEventKey.Function = "F24";
const multimediaKey: KeyboardEventKey.Multimedia = "MediaPlayPause";
const audioKey: KeyboardEventKey.Audio = "AudioVolumeUp";
const browserKey: KeyboardEventKey.Browser = "BrowserBack";

// @ts-expect-error navigation keys do not belong to the modifier category
const invalidModifierCategory: KeyboardEventKey.Modifier = "ArrowLeft";

// @ts-expect-error modifier keys do not belong to the navigation category
const invalidNavigationCategory: KeyboardEventKey.Navigation = "Shift";

const printableKey: KeyboardEventKey = "k";
const printableWhitespace: KeyboardEventKey = " ";
const internationalKey: KeyboardEventKey = "é";
const nonLatinKey: KeyboardEventKey = "あ";
const futureKey: KeyboardEventKey = "FutureKeyboardAction";
const extensibleKeyString: KeyboardEventKey.KeyString = "🧑‍💻";

const knownShortcuts: KnownKeyChordShortcut[] = [
	"A",
	"Z",
	"0",
	"9",
	"ArrowLeft",
	"Backspace",
	"Enter",
	"F12",
	"F13",
	"F24",
	"PageDown",
	"MediaPlayPause",
	"AudioVolumeUp",
	"BrowserBack",
	"Space",
	"Comma",
	"Minus",
	"Period",
	"Plus",
];

// @ts-expect-error normalized letter shortcuts use uppercase keycaps
const lowercaseKnownShortcut: KnownKeyChordShortcut = "k";

// @ts-expect-error international characters require the open shortcut type
const internationalKnownShortcut: KnownKeyChordShortcut = "é";

// @ts-expect-error standalone Alt is a modifier rather than a terminal shortcut
const altKnownShortcut: KnownKeyChordShortcut = "Alt";

// @ts-expect-error standalone AltGraph is a modifier rather than a terminal shortcut
const altGraphKnownShortcut: KnownKeyChordShortcut = "AltGraph";

// @ts-expect-error standalone CapsLock is a modifier rather than a terminal shortcut
const capsLockKnownShortcut: KnownKeyChordShortcut = "CapsLock";

// @ts-expect-error standalone Control is a modifier rather than a terminal shortcut
const controlKnownShortcut: KnownKeyChordShortcut = "Control";

// @ts-expect-error standalone Fn is a modifier rather than a terminal shortcut
const fnKnownShortcut: KnownKeyChordShortcut = "Fn";

// @ts-expect-error standalone Hyper is a legacy modifier rather than a terminal shortcut
const hyperKnownShortcut: KnownKeyChordShortcut = "Hyper";

// @ts-expect-error standalone Meta is a modifier rather than a terminal shortcut
const metaKnownShortcut: KnownKeyChordShortcut = "Meta";

// @ts-expect-error standalone Shift is a modifier rather than a terminal shortcut
const shiftKnownShortcut: KnownKeyChordShortcut = "Shift";

// @ts-expect-error standalone Super is a legacy modifier rather than a terminal shortcut
const superKnownShortcut: KnownKeyChordShortcut = "Super";

// @ts-expect-error standalone SymbolLock is a modifier rather than a terminal shortcut
const symbolLockKnownShortcut: KnownKeyChordShortcut = "SymbolLock";

const extensibleShortcuts: KeyChordShortcut[] = ["K", "é", "あ", "FutureKeyboardAction"];
const knownChords: KnownKeyChord[] = [
	"K",
	"Mod+K",
	"Aux+K",
	"Alt+K",
	"Shift+K",
	"Mod+Aux+Alt+Shift+K",
	"Mod+Shift+PageDown",
	"Alt+MediaPlayPause",
	"Mod+AudioVolumeUp",
	"Shift+F12",
	"Aux+F13",
	"Mod+Alt+F24",
];

// @ts-expect-error known chords reject misspelled standardized shortcuts
const misspelledKnownChord: KnownKeyChord = "Mod+PageDwon";

// @ts-expect-error known chords preserve canonical Mod, Aux, Alt, Shift ordering
const noncanonicalKnownChord: KnownKeyChord = "Shift+Mod+K";

// @ts-expect-error known chords reject repeated modifiers
const repeatedModifierKnownChord: KnownKeyChord = "Mod+Mod+K";

// @ts-expect-error known chords require a non-modifier terminal shortcut
const standaloneModifierKnownChord: KnownKeyChord = "Shift";

// @ts-expect-error known chords require a non-modifier terminal shortcut
const terminalModifierKnownChord: KnownKeyChord = "Mod+Alt";

// @ts-expect-error known chords reject normalized lowercase letter shortcuts
const lowercaseKnownChord: KnownKeyChord = "Mod+k";

// @ts-expect-error known chords reject unknown future browser key values
const futureKnownChord: KnownKeyChord = "Mod+FutureKeyboardAction";

declare const arbitraryString: string;

const chordFromString: KeyChord = arbitraryString;
const shortcutFromString: KeyChordShortcut = arbitraryString;
const chord: KeyChord | "" = getKeyChord({} as KeyboardEvent);
const navigationChord: KeyChord = "Mod+PageDown";
const internationalChord: KeyChord = "é";
const modifiedInternationalChord: KeyChord = "Mod+Shift+é";
const futureChord: KeyChord = "Mod+FutureKeyboardAction";
const futureFunctionChord: KeyChord = "Mod+F25";
const mediaChord: KeyChord = "Alt+MediaPlayPause";
const modifier: "ctrlKey" | "metaKey" = modKey;
const auxiliary: "ctrlKey" | "metaKey" = auxKey;
const matched: boolean = matchKeyChord("Mod+K", {} as KeyboardEvent);
const matchedFromString: boolean = matchKeyChord(arbitraryString, {} as KeyboardEvent);
const label: string = getKeyChordLabel("Mod+K");
const symbols: string[] = getKeyChordSymbols("Mod+K");
const aria: string = getKeyChordAriaKeyShortcuts("Mod+K");

if (chord) {
	matchKeyChord(chord, {} as KeyboardEvent);
	getKeyChordLabel(chord);
	getKeyChordSymbols(chord);
	getKeyChordAriaKeyShortcuts(chord);
}

void [
	altGraphKnownShortcut,
	altKnownShortcut,
	aria,
	audioKey,
	auxiliary,
	browserKey,
	capsLockKnownShortcut,
	chord,
	chordFromString,
	controlKnownShortcut,
	editingKey,
	extensibleKeyString,
	extensibleShortcuts,
	fnKnownShortcut,
	functionKey,
	futureChord,
	futureFunctionChord,
	futureKey,
	futureKnownChord,
	hyperKnownShortcut,
	internationalChord,
	internationalKey,
	internationalKnownShortcut,
	invalidModifierCategory,
	invalidNavigationCategory,
	invalidPhysicalModifierCategory,
	knownChords,
	knownKeys,
	knownShortcuts,
	label,
	lowercaseKnownChord,
	lowercaseKnownShortcut,
	matched,
	matchedFromString,
	mediaChord,
	metaKnownShortcut,
	misspelledKnownChord,
	modifiedInternationalChord,
	modifier,
	modifierKey,
	multimediaKey,
	navigationChord,
	navigationKey,
	noncanonicalKnownChord,
	nonLatinKey,
	physicalCodes,
	printableKey,
	printableKnownKey,
	printableKnownSpaceKey,
	printableWhitespace,
	printableWhitespaceKey,
	repeatedModifierKnownChord,
	shiftKnownShortcut,
	shortcutFromString,
	standaloneModifierKnownChord,
	superKnownShortcut,
	symbolLockKnownShortcut,
	symbols,
	terminalModifierKnownChord,
	unknownKnownKey,
	unknownPhysicalCode,
];
