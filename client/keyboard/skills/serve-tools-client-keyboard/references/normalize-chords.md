# Normalize chords

- Use `matchKeyChord` for exact matching and `getKeyChord` when the canonical chord is also needed.
- Keep `Mod`, `Aux`, `Alt`, and `Shift` in canonical order.
- Use `KnownKeyChord` when a statically defined shortcut should reject unknown keys, standalone modifiers, or incorrect modifier ordering.
- Use `KeyChord` for runtime events and shortcuts that can include international characters or future browser key values.
- Keep the shortcut open to named, international, and future `KeyboardEvent.key` values.
- Do not assume the open `KeyChord` type rejects arbitrary strings or misspelled named keys.
- Preserve the map-first `keyCode` behavior for base A-Z, digit, and punctuation keycaps across keyboard layouts.
  Do not replace it with `key` or `code` without changing the contract and cross-layout tests.
- Expect modifier-only, IME composition, and AltGraph events to return an empty chord.
