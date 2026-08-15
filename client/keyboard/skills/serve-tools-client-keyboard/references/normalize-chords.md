# Normalize chords

- Use `matchKeyChord` for exact matching and `getKeyChord` when the canonical chord is also needed.
- Keep `Mod`, `Aux`, `Alt`, and `Shift` in canonical order.
- Keep the shortcut open to named, international, and future `KeyboardEvent.key` values.
- Preserve the map-first `keyCode` behavior for base A-Z, digit, and punctuation keycaps across keyboard layouts.
  Do not replace it with `key` or `code` without changing the contract and cross-layout tests.
- Expect modifier-only, IME composition, and AltGraph events to return an empty chord.
