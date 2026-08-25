# @serve-tools/client-keyboard

The `@serve-tools/client-keyboard` package normalizes platform-relative keyboard chords and presents them as accessible labels, visual symbols, and ARIA shortcuts.

## Install

```shell
npm install @serve-tools/client-keyboard
```

## Keyboard chords

```ts
import {
	getKeyChord,
	getKeyChordAriaKeyShortcuts,
	getKeyChordLabel,
	getKeyChordSymbols,
	matchKeyChord,
} from "@serve-tools/client-keyboard";

if (matchKeyChord("Mod+Shift+K", event)) {
	event.preventDefault();
}

getKeyChord(event); // "Mod+Shift+K"
getKeyChordLabel("Mod+Shift+K"); // "Command, Shift, and K" on Apple platforms
getKeyChordSymbols("Mod+Shift+K"); // ["⌘", "⇧", "K"] on Apple platforms
getKeyChordAriaKeyShortcuts("Mod+Shift+K"); // "Meta+Shift+K" on Apple platforms
```

Chord extraction intentionally uses a narrow legacy `keyCode` map before falling back to `KeyboardEvent.key`.
This preserves the unmodified A-Z, digit, and punctuation keycap across keyboard layouts and modified character states.
The public chord contract remains open to other named keys, international characters, and future platform key values such as `PageDown` or `AudioVolumeUp`.

`getKeyChord()` produces `Mod`, `Aux`, `Alt`, and `Shift` in canonical order.
Modifier-only, IME composition, and AltGraph events do not produce chords.
`matchKeyChord()` compares the complete canonical chord exactly.

## Keyboard event types

`KeyboardEvent.code` identifies a physical key, while `KeyboardEvent.key` identifies the logical value produced by a key event.
Import the package's keyboard event and chord types from its public entrypoint:

```ts
import type {
	KeyboardEventCode,
	KeyboardEventKey,
	KnownKeyboardEventKey,
} from "@serve-tools/client-keyboard";

const physicalKey: KeyboardEventCode = "KeyK";
const physicalModifier: KeyboardEventCode.Modifier = "ShiftLeft";
const namedKey: KnownKeyboardEventKey = "AudioVolumeUp";
const audioKey: KeyboardEventKey.Audio = "AudioVolumeUp";
const multimediaKey: KeyboardEventKey.Multimedia = "MediaPlayPause";
const internationalKey: KeyboardEventKey = "é";
const futureKey: KeyboardEventKey = "FutureBrowserKey";
```

`KeyboardEventCode` is a closed union of standardized physical-key codes and rejects unknown code strings.
Its namespace groups codes by their W3C categories, including modifiers, alphanumeric keys, control-pad keys, arrow-pad keys, numpad keys, function keys, media keys, legacy keys, international keys, and special keys.
`KnownKeyboardEventKey` is a closed union of standardized named logical keys, such as `Enter`, `ArrowDown`, and `AudioVolumeUp`.
`KeyboardEventKey` combines these known names with `KeyboardEventKey.KeyString`, preserving autocomplete while accepting printable characters, international characters, and future browser key values.
The `KeyboardEventKey` namespace also groups known names by categories such as modifiers, navigation, editing, function keys, multimedia, and browser controls.

## Strict and extensible chord types

Use `KnownKeyChord` when a statically defined shortcut should reject unknown key names, standalone modifiers, and noncanonical modifier ordering:

```ts
import type {
	KeyChord,
	KeyChordShortcut,
	KnownKeyChord,
	KnownKeyChordShortcut,
} from "@serve-tools/client-keyboard";

const standardShortcut: KnownKeyChord = "Mod+Shift+K";
const mediaShortcut: KnownKeyChord = "Mod+AudioVolumeUp";
const knownTerminalKey: KnownKeyChordShortcut = "AudioVolumeUp";

const internationalShortcut: KeyChord = "Mod+é";
const futureShortcut: KeyChord = "Shift+FutureBrowserKey";
const openTerminalKey: KeyChordShortcut = "é";
```

`KnownKeyChordShortcut` contains recognized non-modifier terminal keys and rejects standalone modifiers such as `Control`, `Alt`, and `Shift`.
`KnownKeyChord` combines those known shortcuts with optional modifiers in the canonical `Mod`, `Aux`, `Alt`, `Shift` order.
For example, `"Mod+Shift+K"` is valid, while `"Shift+Mod+K"` and `"Mod+Typo"` are rejected.
`KeyChordShortcut` extends known shortcut keys with `KeyboardEventKey.KeyString`, and `KeyChord` keeps the existing runtime contract open to international characters and future keys.
The open chord types offer known-key autocomplete but do not reject every unknown or misspelled string.
Use `KeyChord` for values returned by `getKeyChord()` and accepted by the package's matching and presentation functions.

## Platform conventions

`Mod` means Command on Apple platforms and Control elsewhere.
`Aux` means Control on Apple platforms and Meta elsewhere.

The exported `modKey` and `auxKey` constants provide the corresponding `KeyboardEvent` property names.
`isApplePlatform` and `isWindowsPlatform` expose the platform classification used by every formatter.
These values are determined once from `navigator.platform` when the module loads.

## Public API

- `getKeyChord` returns a canonical chord or an empty string for incomplete input.
- `matchKeyChord` exactly matches a canonical chord against an event.
- `getKeyChordLabel` produces platform-specific accessible prose.
- `getKeyChordSymbols` produces platform-specific visual key symbols.
- `getKeyChordAriaKeyShortcuts` expands relative modifiers for `aria-keyshortcuts`.
- `KeyboardEventCode` describes standardized physical-key codes and exposes categorized namespace types.
- `KnownKeyboardEventKey` describes standardized named logical keys.
- `KeyboardEventKey` adds printable, international, and future key values to the known logical keys.
- `KnownKeyChordShortcut` and `KnownKeyChord` validate known terminal keys and canonical shortcut definitions.
- `KeyChordShortcut` and `KeyChord` remain open to browser-standard, international, and future key values.
- `modKey`, `auxKey`, `isApplePlatform`, and `isWindowsPlatform` expose the package's platform conventions.

## Compatibility

The package is an ES module for browser windows and reads `navigator.platform` when evaluated.

## Demo

The [`demo`](./demo) workspace captures keyboard events and presents their canonical chords, platform labels, symbols, and ARIA shortcuts:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/keyboard/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-keyboard
npm run dev --workspace @serve-tools/client-keyboard-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-keyboard/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs unit tests and browser integration tests in Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/client-keyboard
```

Run the opt-in Chromium benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/client-keyboard
```

Regenerate the committed keyboard event types from checked-in, pinned W3C UI Events source fixtures with:

```shell
npm run generate:keyboard-types --workspace @serve-tools/client-keyboard
```

This maintainer-only command is explicit, and ordinary installation, builds, and tests use the committed generated types without requiring network access.

## License

[MIT-0](./LICENSE.md)
