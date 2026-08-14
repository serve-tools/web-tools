---
name: serve-tools-client-keyboard
description: Use @serve-tools/client-keyboard for canonical platform-relative keyboard chords, exact matching, accessible labels, visual symbols, ARIA shortcuts, and Apple, Windows, or other platform conventions. Do not use for pointer input, one-shot browser interactions, server, or worker code.
---

# Use @serve-tools/client-keyboard

## Normalize chords

- Use `matchKeyChord` for exact matching and `getKeyChord` when the canonical chord is also needed.
- Keep `Mod`, `Aux`, `Alt`, and `Shift` in canonical order.
- Keep the shortcut open to named, international, and future `KeyboardEvent.key` values.
- Preserve the map-first `keyCode` behavior for base A-Z, digit, and punctuation keycaps across keyboard layouts.
  Do not replace it with `key` or `code` without changing the contract and cross-layout tests.
- Expect modifier-only, IME composition, and AltGraph events to return an empty chord.

## Present shortcuts

- Use `getKeyChordLabel` for accessible prose.
- Use `getKeyChordSymbols` for visual key presentation.
- Use `getKeyChordAriaKeyShortcuts` for the `aria-keyshortcuts` attribute.
- Use `modKey`, `auxKey`, `isApplePlatform`, and `isWindowsPlatform` when application behavior must follow the same conventions.
- Expect platform constants to be determined from `navigator.platform` when the module loads.

## Validate changes

Update runtime behavior, declarations, README examples, node and browser tests, type fixtures, benchmarks, exports, and package shape together.
Test map-first key values, named and international keys, modifier ordering, composition, AltGraph, exact matching, labels, symbols, ARIA expansion, and Apple, Windows, and Linux conventions.
