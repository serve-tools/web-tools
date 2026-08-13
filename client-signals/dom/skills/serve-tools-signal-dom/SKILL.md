---
name: serve-tools-signal-dom
description: Use @serve-tools/signal-dom when implementing, reviewing, migrating, or debugging functional HTML, SVG, MathML, shadow DOM, CSS, and ElementInternals templates backed by @serve-tools/signal. Covers reactive bindings, group persistence, and terminal disposal; do not use for JSX, virtual DOM frameworks, or unrelated DOM helpers.
---

# Use @serve-tools/signal-dom

## Build platform DOM directly

1. Use `html`, `svg`, or `mathml` to create element templates; use `text`, `attrs`, and `props` for content and bindings.
2. Call the returned template function with a parent to mount real DOM nodes.
3. Pass static values when reactivity is unnecessary.
   Pass `Signal.State` or `Signal.Computed` values only where updates must propagate.
4. Use `group()` for a conditionally presented persistent region of nodes.

## Preserve reactive lifecycles

- Do not assume removing nodes disposes their bindings.
  Call `dispose(root)` when a subtree is permanently retired.
- Treat disposal as terminal and idempotent.
  It covers current descendants and shadow content without removing DOM.
- Let ordinary true/false `group()` toggles preserve nodes and subscriptions.
  Dispose the region only when it will never return.
- Do not dispose a custom element merely because `disconnectedCallback()` fired if the same instance may reconnect.

## Use advanced platform features deliberately

- Use `css` for a constructed stylesheet and `adoptedCSS` to adopt it.
  Dispose an independently used reactive sheet directly.
- Use `shadowRoot()` and `elementInternals()` only on valid hosts and only once per host, matching the platform constraints.
- Prefer `attrs` for extensible attribute names and `props` for strictly typed DOM properties.
- Import runtime functions and the `DOM` type from the package root.
  Do not restore removed `/pure`, `/hms`, `/types`, or configurable `use({ Signal })` APIs.

## Migrate from `@signal-utils/dom`

1. Replace the package specifier with `@serve-tools/signal-dom`.
2. Import runtime functions and the `DOM` type from the package root instead of `/pure`, `/hms`, or `/types`.
3. Import `Signal` from `@serve-tools/signal` and replace `use.Signal` references with that import.
4. Remove `use({ Signal })`; this package uses the shared Signal dependency directly.
5. Keep static values static so they continue to avoid reactive effects.

## Validate changes

Update runtime behavior, generated or handwritten declarations, README, Node DOM tests, browser tests, and type fixtures together.
Test disposal and reconnection paths, not only initial rendering.
