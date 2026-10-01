# Styling contract

Base components expose styling through four platform surfaces: the custom-element host, custom states, shadow parts, and authored light DOM.
Use the narrowest surface that owns the presentation you need.

## Conventions

- Style the component host for outer layout, inherited typography and color, and component CSS custom properties.
- Use `:state(name)` for a condition owned or derived by the component.
  Custom-state names never include the `--` prefix used by the older `:--name` proposal.
- Use `::part(name)` only for a node owned inside an open shadow root.
  A part exposes that element, not its descendants, and its name describes structure rather than state.
- Use `[slot="name"]` or a more specific native selector for authored light-DOM nodes.
  A slot name selects a participant in the component's composition contract; it does not make that node a shadow part.
- Style authored native controls with their native selectors and pseudo-classes.
  For example, use `base-dialog > dialog[open]`, `base-popover > [popover]:popover-open`, and `base-file > input[type="file"]:disabled`.
- Treat `data-*` attributes in the inventory as explicit compatibility or per-node presentation hooks.
  New host conditions should use custom states when the component owns the condition.

Several components use a `slot` attribute only to identify authored structure and do not create a corresponding shadow `<slot>`.
This is intentional for controllers such as Collapsible, Dialog, Menu, Tabs, and Scroll Area, which leave native nodes in light DOM.
External author CSS can therefore select those nodes directly.

Do not depend on anonymous shadow markup, generated IDs, undocumented owned accessibility attributes, or classes that are absent from this inventory.
Documented owned attributes such as Tabs `aria-selected` may be read as selectors, but applications must not overwrite them while the node participates.
Parts and states are additive public hooks; existing names are retained when a new hook is introduced.

## Shared binary-control theme

Checkbox and Switch intentionally share the `control` structural part and the `checked`, `disabled`, and `readonly` host states.
Their authored decorative nodes use different semantic slots.

```css
app-checkbox::part(control),
app-switch::part(control) {
  box-sizing: border-box;
  inline-size: 2.25rem;
  block-size: 1.25rem;
  border: 0;
  border-radius: 999px;
  background: Canvas;
  box-shadow: inset 0 0 0 1px CanvasText;
}

app-checkbox:state(checked)::part(control),
app-switch:state(checked)::part(control) {
  color: HighlightText;
  background: Highlight;
}

app-checkbox:state(disabled),
app-switch:state(disabled) {
  opacity: 0.55;
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

The first two rules cross the shadow boundary through `::part(control)`.
The last rule styles nodes authored by the application, so it uses ordinary light-DOM selectors.

## Complete component inventory

An em dash means the class does not expose that kind of hook.
"Authored structure" lists selectors or slot markers that participate in behavior and remain directly styleable by application CSS.

| Class                   | Shadow parts                                                                                                                                                          | Authored structure and slots                                                                                                                  | Host custom states                                                                                   | Other styling hooks                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BaseElement`           | —                                                                                                                                                                     | Subclass-defined layout                                                                                                                       | —                                                                                                    | Host selector and inherited properties                                                                                                                                   |
| `FormAssociatedElement` | —                                                                                                                                                                     | Subclass-defined control content                                                                                                              | —                                                                                                    | Reflected `disabled`, `readonly`, and `required` attributes                                                                                                              |
| `AccordionElement`      | —                                                                                                                                                                     | Direct `CollapsibleElement` children                                                                                                          | `disabled`, `multiple`, `horizontal`, `vertical`                                                     | Reflected attributes of the same names except `horizontal`/`vertical`, which derive from `orientation`                                                                   |
| `AlertDialogElement`    | —                                                                                                                                                                     | Direct `dialog`                                                                                                                               | —                                                                                                    | `dialog[open]`, `dialog::backdrop`                                                                                                                                       |
| `AutocompleteElement`   | —                                                                                                                                                                     | Direct `input`, direct `[popover]`, descendant `OptionElement` nodes                                                                          | —                                                                                                    | Native input/popup selectors; owned `data-filtered` on excluded options                                                                                                  |
| `AvatarElement`         | `image`, `fallback`                                                                                                                                                   | Default content is rendered inside the fallback                                                                                               | `idle`, `loading`, `loaded`, `error`, `fallback`                                                     | `hidden` on the inactive shadow node                                                                                                                                     |
| `CalendarElement`       | `label`, `grid`, `weekdays`, `weekday`, `row`, `day`; conditional tokens `today`, `selected`, `outside` also identify day buttons                                     | Default slot after the grid                                                                                                                   | —                                                                                                    | Generated day buttons also carry `data-current`, `data-selected`, and `data-outside`                                                                                     |
| `CheckboxElement`       | `control`                                                                                                                                                             | Default slot; `indicator` slot inside the control                                                                                             | `checked`, `indeterminate`, `disabled`, `readonly`                                                   | `checked` configures the reset default; the custom state reports current checkedness. `disabled` and `readonly` are reflected restrictions                               |
| `CheckboxGroupElement`  | —                                                                                                                                                                     | Direct `CheckboxElement` children                                                                                                             | `disabled`                                                                                           | Host `disabled` attribute and child states                                                                                                                               |
| `CollapsibleElement`    | —                                                                                                                                                                     | Direct native button, or a button in a direct heading; direct `[slot="panel"]`                                                                | `open`, `closed`, `disabled`                                                                         | Native button pseudo-classes and `[slot="panel"][hidden]`                                                                                                                |
| `ComboboxElement`       | —                                                                                                                                                                     | Direct text `input`, direct `[popover]`, descendant `OptionElement` nodes                                                                     | —                                                                                                    | Native input and `:popover-open` selectors                                                                                                                               |
| `ContextMenuElement`    | —                                                                                                                                                                     | Direct `[slot="trigger"]`, direct `[popover]`, Menu item descendants                                                                          | `open`, `horizontal`, `vertical`                                                                     | `--base-context-menu-x`, `--base-context-menu-y` on the popup; Menu item hooks                                                                                           |
| `DialogElement`         | —                                                                                                                                                                     | Direct `dialog`                                                                                                                               | —                                                                                                    | `dialog[open]`, `dialog::backdrop`                                                                                                                                       |
| `DrawerElement`         | —                                                                                                                                                                     | Direct `dialog`; one direct `[slot="handle"]` inside it                                                                                       | —                                                                                                    | `--base-drawer-progress`, `--base-drawer-offset`, `data-dragging`; native dialog hooks                                                                                   |
| `TextFieldElement`      | `content`, `label-content`, `label`, `control-content`, `control`, `description-content`, `description`, `error-content`, `error`, `before`, `after`, `label-actions` | `label`, `description`, `error`, `before`, `after`, `label-actions`                                                                           | `valid`, `invalid`, `dirty`, `touched`, `filled`, `disabled`, `required`, `error-visible`            | `multiline`, `revealed`, and `type` attributes; CSS password masking; native editor pseudo-classes                                                                       |
| `FieldElement`          | `content`, `label-content`, `control-content`, `description-content`, `error-content`; matching parts on all seven slots                                              | `label`, `control`, `description`, `error`, `before`, `after`, `label-actions`                                                                | `valid`, `invalid`, `dirty`, `touched`, `filled`, `focused`, `disabled`, `required`, `error-visible` | Native pseudo-classes on the authored control; empty sections and unrevealed errors are hidden                                                                           |
| `FileElement`           | —                                                                                                                                                                     | Exactly one direct `input[type="file"]`                                                                                                       | —                                                                                                    | Native input pseudo-classes                                                                                                                                              |
| `MenuElement`           | —                                                                                                                                                                     | Direct `button[slot="trigger"]`, direct `[popover]`, descendant explicit menu-item roles                                                      | `open`, `horizontal`, `vertical`                                                                     | `data-close-on-click` on items; native `:popover-open` and control pseudo-classes                                                                                        |
| `MenubarElement`        | —                                                                                                                                                                     | Direct explicit menu items and direct Menu trigger proxies                                                                                    | `horizontal`, `vertical`                                                                             | Native control pseudo-classes                                                                                                                                            |
| `MeterElement`          | `meter`                                                                                                                                                               | Default slot                                                                                                                                  | `optimum`, `suboptimal`, `even-less-good`                                                            | Numeric host attributes                                                                                                                                                  |
| `NavigationMenuElement` | —                                                                                                                                                                     | Direct `[slot="list"]`, its rows and links/buttons, descendant authored popovers                                                              | `open`, `horizontal`, `vertical`                                                                     | Native link, button, and `:popover-open` selectors                                                                                                                       |
| `NumberFieldElement`    | —                                                                                                                                                                     | Default direct `input[type="number"]`; `decrement` and `increment` button slots                                                               | `disabled`, `readonly`, `invalid`                                                                    | Native input/button pseudo-classes                                                                                                                                       |
| `OptionElement`         | —                                                                                                                                                                     | Authored option contents                                                                                                                      | `active`, `selected`, `disabled`                                                                     | Retained `data-active`, `data-selected`, and `data-disabled`; Autocomplete may own `data-filtered`                                                                       |
| `OTPFieldElement`       | `segments`                                                                                                                                                            | Default direct text/password/tel input; `segment` slot                                                                                        | `complete`, `disabled`, `readonly`, `invalid`                                                        | Each segment receives `data-value`, `data-filled`, and `data-active`                                                                                                     |
| `PopoverElement`        | —                                                                                                                                                                     | Direct `[popover]`                                                                                                                            | —                                                                                                    | Native `:popover-open` selector                                                                                                                                          |
| `PreviewCardElement`    | —                                                                                                                                                                     | Direct `a[slot="trigger"][href]` or fallback direct `a[href]`; direct `[popover]`                                                             | —                                                                                                    | Native link and `:popover-open` selectors                                                                                                                                |
| `ProgressElement`       | `progress`                                                                                                                                                            | Default slot                                                                                                                                  | `indeterminate`, `progressing`, `complete`                                                           | Numeric host attributes                                                                                                                                                  |
| `ScrollAreaElement`     | —                                                                                                                                                                     | Direct `[slot="viewport"]`; optional `[slot="content"]` inside it; direct `scrollbar-x`/`scrollbar-y` rails with `thumb-x`/`thumb-y` children | `overflow-x`, `overflow-y`, `inline-start`, `inline-end`, `block-start`, `block-end`                 | Host `--base-scroll-inline`, `--base-scroll-block`, `--base-scroll-max-inline`, `--base-scroll-max-block`; rail `--base-scroll-thumb-size`, `--base-scroll-thumb-offset` |
| `SelectElement`         | —                                                                                                                                                                     | Direct native button, direct `[popover]`, descendant `OptionElement` nodes                                                                    | —                                                                                                    | Native button and `:popover-open` selectors                                                                                                                              |
| `SeparatorElement`      | `separator`                                                                                                                                                           | —                                                                                                                                             | `decorative`, `horizontal`, `vertical`                                                               | Reflected `decorative` and `orientation` attributes                                                                                                                      |
| `SliderElement`         | `track`                                                                                                                                                               | Default direct `input[type="range"]`; optional `thumb` slot                                                                                   | `disabled`, `multiple`, `vertical`                                                                   | Track `--base-slider-min`, `--base-slider-max`, and `--base-slider-value-N`; native range pseudo-elements                                                                |
| `SwitchElement`         | `control`                                                                                                                                                             | Default slot; `thumb` slot inside the control                                                                                                 | `checked`, `disabled`, `readonly`                                                                    | `checked` configures the reset default; the custom state reports current checkedness. `disabled` and `readonly` are reflected restrictions                               |
| `TabsElement`           | —                                                                                                                                                                     | Direct `[slot="tablist"]` containing buttons; direct `[slot="panel"]` nodes                                                                   | —                                                                                                    | Native button pseudo-classes, owned `aria-selected`, and panel `hidden` state                                                                                            |
| `ToastRegionElement`    | `toast` on the toast slot; `announcer-polite`, `announcer-assertive`                                                                                                  | Direct `[slot="toast"][id]`; descendant `button[slot="dismiss"]`                                                                              | —                                                                                                    | Toast `hidden`; optional `data-base-duration`                                                                                                                            |
| `ToggleElement`         | —                                                                                                                                                                     | First direct native button                                                                                                                    | `pressed`, `disabled`                                                                                | Native button pseudo-classes and owned `aria-pressed`                                                                                                                    |
| `ToggleGroupElement`    | —                                                                                                                                                                     | Direct `ToggleElement` children                                                                                                               | `disabled`, `multiple`, `horizontal`, `vertical`                                                     | Child Toggle states                                                                                                                                                      |
| `ToolbarElement`        | —                                                                                                                                                                     | Direct native buttons, links, inputs, selects, and textareas; direct Menu and Toggle proxies                                                  | `disabled`, `horizontal`, `vertical`                                                                 | Native control pseudo-classes                                                                                                                                            |
| `TooltipElement`        | —                                                                                                                                                                     | Direct `[slot="trigger"]` or fallback direct native interactive element; direct `[popover]`                                                   | —                                                                                                    | Native trigger pseudo-classes and `:popover-open`                                                                                                                        |

## State and structure examples

Use structural parts and state together when a component owns both:

```css
app-avatar::part(image),
app-avatar::part(fallback) {
  inline-size: 3rem;
  block-size: 3rem;
  border-radius: 50%;
}

app-avatar:state(loading)::part(fallback) {
  opacity: 0.6;
}

app-calendar::part(day selected) {
  color: HighlightText;
  background: Highlight;
}
```

Multiple tokens in `::part(day selected)` require the same shadow element to expose both part names.
Calendar uses this pattern because `selected`, `today`, and `outside` describe individual shadow-owned day buttons rather than the host as a whole.

Use ordinary CSS for authored native structure:

```css
app-menu > [popover] {
  padding: var(--menu-padding, 0.5rem);
  border: 0;
  box-shadow:
    0 0 0 1px CanvasText,
    0 0.25rem 1rem color-mix(in srgb, CanvasText 25%, transparent);
}

app-menu > [popover]:popover-open {
  display: grid;
}

app-tabs > [slot="tablist"] > button[aria-selected="true"] {
  text-decoration: underline;
}

@media (forced-colors: active) {
  app-menu > [popover] {
    outline: 1px solid CanvasText;
  }
}
```

The owned ARIA and `hidden` attributes in these examples are observable native presentation state, but applications must not overwrite them while the node participates in a component.

For `OptionElement`, `:state(selected)` and `data-selected` report current selection.
The `selected` content attribute and `defaultSelected` property remain the form-reset default and may intentionally differ after interaction or a programmatic current-value assignment.
`:state(disabled)` and `data-disabled` both report an explicit `disabled` attribute or an invalid option identity, including a duplicate or missing value in its current owner.

## Cost boundary

Custom states require `ElementInternals`.
Adding Option's `active`, `selected`, and `disabled` states therefore makes the option attach its otherwise lazy internals and perform three state synchronizations alongside the retained `data-*` compatibility attributes.
This bounded cost creates one consistent state surface for a host-owned condition.
The current Base benchmark subset does not cover Option or the selection controls, so this change makes no selection-performance claim.
