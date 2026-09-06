# Base accessibility acceptance

Status: automated browser checks cover the implemented role, name, state, relationship, focus, keyboard, form, and lifecycle contracts within their stated fixtures.
The manual assistive-technology matrix below has not been run and remains a release gate.
This document is an acceptance procedure, not an accessibility certification or a WCAG conformance report.

## Evidence boundary

The component browser suites assert authored and owned ARIA, native semantics, focus movement, keyboard operation, form participation, hidden-content behavior, and interaction state in Chromium, Firefox, and WebKit.
They do not expose each engine's native accessibility tree.

Vitest's DOM-based role locator did not recognize roles supplied through `ElementInternals` in Chromium, Firefox, or WebKit during a September 2, 2026 diagnostic.
That makes it unsuitable for a computed-role smoke test of Checkbox, Switch, Meter, and Progress.
The unsupported test was removed, and the components do not duplicate their `ElementInternals` semantics as host ARIA attributes to accommodate the matcher.

The August 28, 2026 gallery audit used Chromium's native accessibility tree and passed 80 checks across 15 snapshots.
That result belongs only to the recorded source closure SHA-256 `e1fdd8ef04edf6b41f39e560264b1da6c2702b3790afce8d45986fcce4a31f5c`.
It is historical evidence after any source change and must not be represented as a current-worktree result without rebuilding the gallery and repeating the capture.

The September 4 production-template migration rebuilt the gallery and repeated all 80 checks successfully in Chromium 151.0.7922.34, with zero page or console errors.
Its broad input closure SHA-256 was `7ba0464491f3a6fe09d45a810b59e69607f5fcf92b73cb9c8a965cf61f24b1e9` both before and after capture.
The [current acceptance artifacts](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/acceptance/STATUS.md) preserve the source lock, full trees, and semantic checks.
Neither DOM assertions nor an accessibility-tree capture proves what a screen reader announces or whether the interaction is usable.

## Manual support matrix

Record the operating-system, browser, and assistive-technology versions for every run.
The required practical matrix covers the three supported browser families; it is not a claim that unlisted combinations are unsupported.

| Operating system | Browser | Assistive technology | Release expectation |
| ---------------- | ------- | -------------------- | ------------------- |
| Windows          | Chrome  | NVDA                 | Required manual run |
| Windows          | Firefox | NVDA                 | Required manual run |
| macOS            | Safari  | VoiceOver            | Required manual run |
| macOS            | Chrome  | VoiceOver            | Supplemental run    |
| macOS            | Firefox | VoiceOver            | Supplemental run    |

Also complete the keyboard-only and visual checks in current Chrome, Firefox, and Safari.
If a required pair cannot be run, record it as unverified rather than passing it by inference from another browser, screen reader, or automated result.

## Test fixture and setup

Use the built `examples/index.html` gallery so the review covers the package's documented authoring compositions as well as component code.
Start each browser with a fresh profile and default zoom, enable macOS keyboard navigation to all controls, and do not use a mouse during keyboard-only passes.
Repeat the relevant flow in left-to-right and right-to-left direction where the component owns arrow-key direction.

For every result, record:

- date, tester, operating system, browser, and assistive-technology versions;
- gallery source revision or an immutable source-closure hash;
- component, initial state, exact actions, expected result, observed result, and final focus;
- pass, fail, blocked, or not applicable;
- a minimal reproduction and severity for each failure.

## Keyboard-only acceptance

1. Traverse the complete gallery with Tab and Shift+Tab.
   Confirm that focus order preserves meaning, focus is always visible, disabled and hidden content does not create unexpected stops, and no component traps focus.
2. Operate every action without a pointer.
   Confirm Space and Enter activation, Escape dismissal, and native text, number, range, time, radio, file, form, dialog, and popover behavior.
3. Exercise every composite with its documented keys.
   Cover Checkbox Group, Toggle Group, Accordion, Tabs, Calendar, Autocomplete, Combobox, Select, Menu, Context Menu, Menubar, Navigation Menu, and Toolbar with arrows, Home, End, typeahead, and the documented selection keys.
4. Confirm focus after state changes.
   Open and close each overlay, cancel and complete dialogs, change and reset forms, remove and reconnect examples, and confirm focus never becomes lost, duplicated, or stranded in hidden content.
5. Verify the keyboard alternative to File drag and drop and the opt-in F6 path into visible toasts.

## Screen-reader acceptance

Run these checks with each required browser and screen-reader pair.
Use ordinary reading and form-control navigation as well as direct keyboard operation; a control is not accepted merely because it can be found in a landmarks or controls list.

### Forms and binary controls

- Button, Input, Fieldset, Form, Radio, and Radio Group expose their native names, grouping, required and disabled state, validation, editing, selection, reset, and submission behavior.
- Checkbox and Switch announce one name, the correct role, checked or mixed state, disabled and read-only restrictions, required or invalid state, and each state change once.
- Checkbox Group communicates its group name without creating a duplicate form control; the parent checkbox's checked and mixed announcements follow the visible child state.
- Field associates its label, description, and current error with the actual native or form-associated control and does not create a second focus or form identity.
- Number Field, OTP Field, Slider, and File expose only their authored native editors as focus and form identities; step buttons, range limits, descriptions, errors, selected files, and multi-thumb labels remain distinguishable.

### Selection and composite navigation

- Autocomplete, Combobox, and Select announce their name, expanded state, popup type, active option, selected state, multiple-selection state, disabled options, acceptance, and dismissal without moving DOM focus into the listbox.
- Tabs announce one tablist, the selected tab, tab position when available, and the correct tabpanel relationship; automatic and manual activation do not announce hidden panels as active content.
- Accordion and Collapsible announce each disclosure's expanded state and relationship; opening, closing, group navigation, and disabled state remain understandable.
- Calendar announces a named grid, weekday headers, the focused full date, selected state, unavailable dates, month changes, and grid navigation without an application-role mode trap.
- Menu, Context Menu, and Menubar announce menu boundaries, item types, checked and disabled state, submenus, and close or focus-return behavior.
- Navigation Menu retains link and disclosure semantics rather than announcing application-menu roles; Toolbar announces its group and preserves the native identity of each contained control.

### Layers, status, display, and scrolling

- Dialog, Alert Dialog, and Drawer announce their name and description when opened, keep virtual and keyboard focus within a modal interaction, support cancellation and completion, and return focus to a sensible trigger.
- Popover exposes its authored content without adding a synthetic focus model.
- Tooltip announces its description once on focus, does not take focus, closes on Escape, and does not leave a stale description after trigger or popup replacement.
- Preview Card preserves the link's native name and destination, does not take focus when opened, and exposes interactive popup content while focus is inside it.
- Toast Region announces polite and assertive messages with appropriate urgency, does not duplicate a message, preserves the current task's focus, pauses timed dismissal during interaction, and provides a usable F6 and dismiss path.
  Repeat identical messages because DOM and accessibility-tree inspection cannot prove repeated speech.
- Meter and Progress announce one named numeric identity with the current value and bounds; indeterminate progress is distinguishable without exposing the presentational native oracle as a duplicate.
- Avatar exposes either the authored image alternative or fallback content, never two competing image identities.
- Scroll Area keeps its native viewport, visible focus, and reading order; decorative rails stay absent from screen-reader navigation and never hide focusable descendants.

## Visual and presentation acceptance

Run the gallery at 200% text enlargement and at 400% browser zoom in a 1280 CSS-pixel-wide viewport, which produces the 320 CSS-pixel reflow condition.
Confirm content reflows without loss of information or operation, except where two-dimensional layout is essential, and that focused or revealed content is not obscured.
Check text and non-text contrast, visible focus, pointer target size, forced-colors mode, and reduced motion for each documented styling example.

Base components intentionally leave substantial presentation to consumers.
Passing the gallery does not certify arbitrary consumer styles, so release documentation must continue to identify labeling, focus appearance, contrast, motion, and layout as application responsibilities where the component does not own them.

## Release decision

The manual gate closes only when every required matrix row has a dated result and every applicable checklist item passes or has an explicit, reviewed release decision.
Do not convert blocked or unrun rows into passes.
Record supplemental combinations separately so a success there does not conceal a failure or missing result in the required matrix.

The acceptance procedure is informed by WCAG 2.2's [Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order), [Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value), [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages), and [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) guidance.
Component key conventions follow the W3C ARIA Authoring Practices [keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) and applicable [patterns](https://www.w3.org/WAI/ARIA/apg/patterns/).
The W3C [Easy Checks](https://www.w3.org/WAI/test-evaluate/easy-checks/) and [WCAG Evaluation Methodology](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) explain why preliminary checks, evaluation tools, assistive-technology expertise, representative sampling, and recorded findings remain distinct parts of an accessibility review.
