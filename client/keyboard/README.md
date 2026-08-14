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
- `KeyChord` and `KeyChordShortcut` accept browser-standard, international, and future key values.
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

## License

[MIT-0](./LICENSE.md)
