# Style Base components

Choose the selector from the node that owns the presentation.

- Style the custom-element host for outer layout, inherited values, attributes, and component CSS custom properties.
- Use `:state(name)` for component-owned host conditions such as `checked`, `open`, `invalid`, or `vertical`.
- Use `::part(name)` for documented shadow-owned structure such as Checkbox `control`, Avatar `image`, or Slider `track`.
- Use `[slot="name"]` and native selectors for application-authored light DOM.
  A slot name is a composition hook and does not turn the authored node into a shadow part.
- Use native selectors for retained native state: `dialog[open]`, `[popover]:popover-open`, input pseudo-classes, and `dialog::backdrop`.

Do not style anonymous shadow descendants, generated IDs, or undocumented component-owned ARIA relationships.
Documented owned attributes such as Tabs `aria-selected` are read-only selectors; do not overwrite them while the node participates.
Do not use the obsolete `:--state` syntax; custom states use `:state(state)`.

Checkbox and Switch share a structural `control` part and common checked-state selectors while keeping distinct authored decoration slots:

```css
app-checkbox::part(control),
app-switch::part(control) {
  border: 0;
  background: Canvas;
  box-shadow: inset 0 0 0 1px CanvasText;
}

app-checkbox:state(checked)::part(control),
app-switch:state(checked)::part(control) {
  color: HighlightText;
  background: Highlight;
}

app-checkbox > [slot="indicator"],
app-switch > [slot="thumb"] {
  color: currentColor;
}

@media (forced-colors: active) {
  app-checkbox::part(control),
  app-switch::part(control) {
    box-shadow: none;
    outline: 1px solid CanvasText;
  }

  app-checkbox:state(checked)::part(control),
  app-switch:state(checked)::part(control) {
    outline-color: Highlight;
  }
}
```

For authored overlays, style the native nodes directly:

```css
app-menu > [popover] {
  padding: var(--menu-padding, 0.5rem);
  border: 0;
  box-shadow:
    0 0 0 1px CanvasText,
    0 0.25rem 1rem color-mix(in srgb, CanvasText 25%, transparent);
}

@media (forced-colors: active) {
  app-menu > [popover] {
    outline: 1px solid CanvasText;
  }
}
```

The authoritative [styling contract](../../../../components/base/design/styling.md) contains the complete per-component inventory of parts, slots, states, native selectors, data attributes, and CSS custom properties.
For Option, `:state(selected)` is current selection; the `selected` attribute remains its form-reset default.
Its `:state(disabled)` includes explicit disabledness and an invalid option identity such as a duplicate or missing value.
