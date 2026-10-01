# Functional comparison with Reve's design library

## Scope and conclusion

Compared on September 15, 2026 against the local `reve-core/webapp/design-library/src` tree at revision `3a3ca26978a8329359cef08aa6657295e5d0e33f`.
That source tree was clean at comparison time; Base includes the current uncommitted package work.
Reve registers 35 production custom-element names: 27 `rv-*` tags, including the menu item primitives, and eight inspector-field variants.
These are registered names, not 35 independent behavioral families; the freeform inspector is an alias, and two test-fixture registrations are excluded.
Reve has no standalone Radio component; its segmented inspector uses native radios, consistent with Base's native-radio route.
The comparison reads implementations and tests in both libraries, rather than treating matching component names as proof.
Reve's tests were inspected, not executed in this repository.
This is a functional inventory, not a performance comparison, pixel comparison, interchangeable API guarantee, or accessibility certification.

**Base has the behavioral foundations for ordinary forms, selection, navigation, and overlays.**
Many Reve conveniences are absent as packaged features, and some advanced interaction families are genuine gaps.
Native HTML is part of Base's supported composition model: native Button and input/textarea composition remains supported alongside the dedicated TextFieldElement.
Theme tokens, icons, sizes, animation choices, and product-specific inspector layouts are not parity requirements for an unstyled library.

## Basic component mapping

“Core covered” means the ordinary behavior is implemented in Base or deliberately delegated to authored native HTML.
It does not mean every Reve property, event name, default, or convenience feature is supported.

| Reve surface                                   | Base route                                                                       | Functional assessment and boundary                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                                         | Native `<button>` / `<a>`, plus `ToggleElement` when pressed state is needed     | Core activation, disabled state, keyboard behavior, form submit/reset, navigation, and toggling are covered. Loading UI and disabling policy, icons, and caret content are authored.                                                                                                                                                                             |
| Input                                          | Native `<input>` + `FieldElement`; Number Field for numeric affordances          | Editing, selection, composition, constraints, names, labels, disabled/read-only state, submission, and reset are native. TextFieldElement additionally owns its shadow label/editor and offers CSS masking with a revealed property; clear/reveal buttons remain authored.                                                                                       |
| Textarea                                       | Native `<textarea>` + `FieldElement`                                             | Multiline editing, selection, length constraints, labels, errors, submission, and reset are covered. The Input gallery now demonstrates this route. TextFieldElement also supports multiline editing, including CSS-masked secrets. Reve's `grows` behavior is not supplied.                                                                                     |
| Checkbox                                       | `CheckboxElement`                                                                | Checked/indeterminate state, required/disabled/read-only behavior, labels, form values, reset, and restoration are covered. Base additionally exposes cancelable changes and optional unchecked values. Reve's glyph and help layout remain author content.                                                                                                      |
| Switch / base switch                           | `SwitchElement`                                                                  | Binary state, switch semantics, keyboard activation, disabled/read-only behavior, labels, form participation, and reset are covered. Track content is authored.                                                                                                                                                                                                  |
| Select                                         | `SelectElement` + `OptionElement`, or native `<select>`                          | Selection, disabled options, labels, keyboard operation, required validity, form values, and reset are covered. Base also supports multiple selection. Automatic selected-label/placeholder rendering into its authored trigger is absent.                                                                                                                       |
| Combobox                                       | `ComboboxElement` or `AutocompleteElement`, depending on value policy            | Reve separates editable `value` text from `selectedValue` option identity; ordinary suggestions map primarily to Base Autocomplete, not its restricted Combobox. Reve's always-open inline list and action rows that preserve typed text are not first-class Base features. Autocomplete exposes cancelable acceptance and `optionValue` for author composition. |
| Slider                                         | `SliderElement` around native ranges, optionally composed with Number Field      | Numeric constraints, keyboard/pointer editing, disabled state, form values, and reset are covered; Base also coordinates ordered ranges. Reve's integrated editable readout, parse/format hooks, edit cancellation, and tick-jump/snapping policy are not built in. Spring motion is presentation.                                                               |
| Tabs                                           | `TabsElement`                                                                    | Tabs/panels, selected state, disabled tabs, roving focus, orientation, and automatic/manual activation are covered. Reve's visual indicator is author styling.                                                                                                                                                                                                   |
| Menu and menu items                            | `MenuElement` with authored buttons                                              | Actions, keyboard navigation, disabled items, checkbox/radio items, nested submenus, opening, and focus restoration are covered. Reve's data-rendered, virtualized/grid menu and item-card API are not reproduced.                                                                                                                                               |
| Popover panel                                  | `PopoverElement` + native `popovertarget` / `show(source)` + author CSS          | Generic interactive content, declarative click/keyboard invocation, native dismissal, and source association already have a composition route. Reve's convenience trigger API, automatic Floating UI placement/size policy, and generic safe corridor are not built in.                                                                                          |
| Tooltip                                        | `TooltipElement`                                                                 | Hover/focus opening, occupancy delays, description ownership, Escape handling, and trigger focus preservation are covered. Reve's arrow and placement policy are separate.                                                                                                                                                                                       |
| Dialog                                         | `DialogElement`, `AlertDialogElement`, and `DrawerElement` as appropriate        | Native modal/nonmodal state, focus, Escape/cancellation, return values, and dialog-form closure are covered. Headers, close buttons, blocking policy, sheet presentation, and transition-completion events require author composition.                                                                                                                           |
| Avatar                                         | `AvatarElement`                                                                  | Image loading/failure and retained fallback content are covered. Initials extraction and a default person icon are author content.                                                                                                                                                                                                                               |
| Toast                                          | `ToastRegionElement` + authored toast content                                    | Region timing, live-announcement intent, dismissal, and pause/resume behavior are implemented. Reve's toast item is chiefly a styled content shell. Actual assistive-technology announcement remains a manual validation requirement.                                                                                                                            |
| Divider                                        | `SeparatorElement` or native `<hr>`                                              | Separator orientation and decorative presentation are covered.                                                                                                                                                                                                                                                                                                   |
| Badge, icon, keyboard hint, spinner            | HTML/SVG/CSS; a labeled `role="status"` for an indeterminate spinner             | No dedicated rendering classes or Reve icon registry. Use an accessible label/status where meaningful; drawing a spinner alone does not supply loading semantics.                                                                                                                                                                                                |
| Removable tag                                  | Authored content + native remove button                                          | No Tag class or `tag-remove` event. Removal is a small author-owned action; focus after removal and labeling remain the application's responsibility.                                                                                                                                                                                                            |
| Color picker, color-picker popover, eyedropper | Native color input for basic color entry; compose Popover for a panel            | Custom color-space editing, alpha controls, swatches, drag surfaces, and an eyedropper integration are genuine missing features. Native color entry is not full parity with Reve's color tooling.                                                                                                                                                                |
| Inspector fields                               | Compose Field, Select, Toggle Group, Slider, Checkbox/Switch, and native editors | The underlying ordinary controls are available. Reve's complete inspector layouts and coordinated position/color editing are not provided.                                                                                                                                                                                                                       |

## Field authorship

Reve's `form-controls/FormFieldElement.ts` supplies label and description text, adornment slots, section wrappers, and validation feedback.
It is distinct from the older `FieldLabelsMixin` with `label-above` and `label-below`; those names are not the contract being adopted here.
Base now supplies the useful authoring shell around the author's actual native, FACE, or retained-input control.

A simple field needs only `<app-field label="Email" description="Used for recovery.">` and its `slot="control"` input.
Native validation messages supply inline feedback after interaction or attempted validation.
Rich content overrides text through `label`, `description`, and `error` slots; `before` and `after` surround the control, and `label-actions` keeps independent help actions outside the native label.
Five stable wrapper parts support layout customization without a separate slot for every decoration.
This seven-slot surface deliberately avoids reproducing Reve's twelve-slot arrangement and per-adornment blank states.

Unlike Reve's internally rendered control, Base retains the authored control as the sole form owner.
Generated fallback labels therefore live in light DOM beside that control, preserving same-tree native labeling.
No shadow-tree label workaround, hidden form mirror, theme dependency, or asynchronous validation framework is introduced.
See the [Field contract](field.md) for fallback precedence, validation timing, styling, and the `labelElement` migration.

## Prioritized follow-up

1. **Selection display and editor conveniences:** provide opt-in recipes for selected-label/placeholder synchronization, clear actions, password reveal, and slider/number-editor synchronization.
   These are real conveniences, not merely styling; keep author markup and native control identity intact.
2. **Large or rich collections:** decide whether virtualized lists, grid navigation, and richer Combobox acceptance/filtering are supported package goals before adding them.
   They are not established by the current small authored-option examples.
3. **Specialized color controls:** consider a separate opt-in family if custom color-space/alpha editing and eyedropper workflows are required.
   Do not count a native color picker as equivalent.
4. **Overlay positioning policy:** native popovers and authored CSS already cover basic panels.
   A reusable placement/size or pointer-corridor policy would be additional behavior, not a reason to duplicate Menu or introduce menu semantics for ordinary panels.

No Reve theme, icon registry, Floating UI dependency, or source implementation was copied into Base in this pass.
The scope is to verify ordinary behavior and expose gaps, not import the styled library wholesale.

## Evidence and changes from this pass

The [Input gallery](../examples/index.html#component-input) now contains a native multiline editor inside Field, with source code, local submission, required validation, and reset.
The real-browser gallery test exercises the actual composed example rather than a second standalone editor implementation.
It caught a Field reset-ordering defect: a browser-generated reset-button event could run the queued baseline update before the native reset default action, leaving a reset control marked dirty.
Field now captures reset state in a subsequent task, with its existing cancellation and connection guards preserved.
The focused regression covers that trusted interaction in addition to the existing programmatic reset coverage.

Base behavior references: [native composition](native-composition.md), [field state](field.md), [selection](selection.md), [numeric controls](numeric.md), [menus](menus.md), [overlays](overlays.md), [display](display.md), and [transient surfaces](transient-and-scroll.md).
The browser suites are under [`test/browser`](../test/browser/), including `native-composition`, `field`, `gallery`, `checkbox`, `switch`, `selection`, `slider`, `tabs`, `menu`, `popover`, `tooltip`, and `dialog`.

Representative Reve source evidence, in the user's local checkout:

- [Input clear/password controls](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-input/RvInput.ts:299) and [Textarea configuration](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-textarea/RvTextarea.ts:77).
- [Select display rendering](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-select/RvSelect.ts:127) and [Slider readout configuration](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-slider/RvSlider.ts:118).
- [Triggered popover behavior](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/common/TriggeredPopoverElement.ts:119), [menu collection implementation](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-menu/RvMenu.ts:353), and [removable tag behavior](/Users/jonathan/GitHub/reve-ai/reve-core/webapp/design-library/src/rv-tag/RvTag.ts:45).

## Validation and weight before the Field shell

The preceding parity/reset pass completed full root `npm run verify`, including package validation, browser suites, and external packed-package consumers.
The focused Field, native composition, and gallery run passes 177 checks across Chromium, Firefox, and WebKit.
The new example exercises both libraries' shared native editing/form model; it does not test Reve's implementation or establish complete parity.
The reset-ordering correction reduces minified Field and whole-library output by four bytes, with public exports and dependencies unchanged.
The component-only whole library is 184,229 bytes; standalone is 202,990 bytes.
The new textarea composition adds no production component class or dependency.
Source hashes and measured bundles are retained in `/Users/jonathan/Documents/Codex/outputs/base-reve-parity-2026-09-15`.
