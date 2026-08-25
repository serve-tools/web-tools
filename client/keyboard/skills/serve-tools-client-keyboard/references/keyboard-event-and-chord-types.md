# Keyboard event and chord types

Import keyboard event and chord types from `@serve-tools/client-keyboard`.

```ts
import type {
	KeyboardEventCode,
	KeyboardEventKey,
	KeyChord,
	KeyChordShortcut,
	KnownKeyboardEventKey,
	KnownKeyChord,
	KnownKeyChordShortcut,
} from "@serve-tools/client-keyboard";

const physicalKey: KeyboardEventCode = "KeyK";
const physicalModifier: KeyboardEventCode.Modifier = "ShiftLeft";
const namedMediaKey: KnownKeyboardEventKey = "AudioVolumeUp";
const audioKey: KeyboardEventKey.Audio = "AudioVolumeUp";
const multimediaKey: KeyboardEventKey.Multimedia = "MediaPlayPause";
const internationalKey: KeyboardEventKey = "é";

const standardShortcut: KnownKeyChord = "Mod+Shift+K";
const mediaShortcut: KnownKeyChord = "Mod+AudioVolumeUp";
const knownTerminalKey: KnownKeyChordShortcut = "AudioVolumeUp";

const internationalShortcut: KeyChord = "Mod+é";
const futureShortcut: KeyChord = "Shift+FutureBrowserKey";
const openTerminalKey: KeyChordShortcut = "é";
```

- Use `KeyboardEventCode` for physical `KeyboardEvent.code` values such as `"KeyK"`.
- Treat `KeyboardEventCode` as a closed union that rejects unknown physical-key codes and exposes categorized namespace types.
- Use `KnownKeyboardEventKey` when only standardized named logical `KeyboardEvent.key` values are valid.
- Use `KeyboardEventKey` when logical keys may also contain printable characters, international characters, or future browser-defined strings.
- Use the `KeyboardEventKey` namespace for categorized known logical keys and `KeyboardEventKey.KeyString` for its extensible string component.
- Use `KnownKeyChordShortcut` for recognized terminal keys that exclude standalone modifiers.
- Use `KnownKeyChord` to validate known shortcut definitions and enforce the canonical `Mod`, `Aux`, `Alt`, `Shift` modifier order.
- Use `KeyChordShortcut` or `KeyChord` for extensible runtime values, including international characters and future key names.
- Expect `KeyChord` to preserve known-key autocomplete without rejecting every typo, unknown key, or arbitrary open string.
- Keep values returned by `getKeyChord()` compatible with `KeyChord`, `matchKeyChord()`, and the package's shortcut presentation functions.
