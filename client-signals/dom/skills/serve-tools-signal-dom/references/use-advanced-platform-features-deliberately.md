# Use advanced platform features deliberately

- Use `css` for a constructed stylesheet and `adoptedCSS` to adopt it.
  Dispose an independently used reactive sheet directly.
- Use `shadowRoot()` and `elementInternals()` only on valid hosts and only once per host, matching the platform constraints.
- Prefer `attrs` for extensible attribute names and `props` for strictly typed DOM properties.
- Import runtime functions and the `DOM` type from the package root.
  Do not restore removed `/pure`, `/hms`, `/types`, or configurable `use({ Signal })` APIs.
