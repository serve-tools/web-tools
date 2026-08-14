import {
	auxKey,
	getKeyChord,
	getKeyChordAriaKeyShortcuts,
	getKeyChordLabel,
	getKeyChordSymbols,
	type KeyChord,
	matchKeyChord,
	modKey,
} from "../src/client-keyboard.js";

const chord: KeyChord | "" = getKeyChord({} as KeyboardEvent);
const navigationChord: KeyChord = "Mod+PageDown";
const internationalChord: KeyChord = "é";
const modifier: "ctrlKey" | "metaKey" = modKey;
const auxiliary: "ctrlKey" | "metaKey" = auxKey;
const matched: boolean = matchKeyChord("Mod+K", {} as KeyboardEvent);
const label: string = getKeyChordLabel("Mod+K");
const symbols: string[] = getKeyChordSymbols("Mod+K");
const aria: string = getKeyChordAriaKeyShortcuts("Mod+K");

void [aria, auxiliary, chord, internationalChord, label, matched, modifier, navigationChord, symbols];
