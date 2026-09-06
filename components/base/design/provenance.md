# Base implementation provenance

Status: reconciled for the current Base source, browser tests, family contracts, gallery, and integration files.

## License boundary

The donor baseline is `@jsxtools/aui` 0.0.13 at commit `080ad617486945851d0775278d1c8d215bdf75f7`.
Its package metadata declares MIT-0, and the pinned tree contains no separate license or notice file.
`@serve-tools/base-components` is also MIT-0 and distributes `LICENSE.md` with Copyright 2026 Jonathan Neal.
MIT-0 permits reuse without an attribution condition, while the file map below still records donor concepts and behavioral references so the migration remains auditable.

The upstream behavior baseline is [`@base-ui/react` 1.7.0](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/package.json).
Base UI declares MIT, and its [repository license](https://github.com/mui/base-ui/blob/v1.7.0/LICENSE) is Copyright 2019 Material-UI SAS.
That license requires its copyright and permission notice to accompany copies or substantial portions of its software.

The implementation authors attested that Base UI and the donor were used as behavioral and API references, not as copied or substantially adapted implementation or test sources.
The one historical foundation scope without a retained author attestation was checked textually against the complete pinned donor source/tests and Base UI 1.7.0 React package source/tests as described below.
No current Base source or test has an upstream adaptation mapping, so this reconciliation does not add an unrelated Base UI notice to the MIT-0 package.
If later work copies or substantially adapts upstream material, update this ledger with exact source and destination paths and add the applicable notice before distribution.

## Runtime, test, and family-contract map

### Foundation

Commit `5c69122b04667ee675ae00c1420eb81e5a65529a` introduced these files together:

- `src/BaseElement.ts`
- `test/browser/base-element.test.ts`
- `test/browser/lifecycle-failures.test.ts`
- `design/lifecycle.md`

The commit is authored by Jonathan Neal, but the compacted task history does not preserve a contemporaneous independence attestation from that authoring turn.
The architecture is specific to Base custom-element connection resources and `@serve-tools/signal-dom` binding scopes; Base UI is a React library and has no corresponding custom-element lifecycle base.

A bounded text audit compared the four complete files with 93 source/test files from donor commit `080ad617` and 1,190 TypeScript, JavaScript, and Markdown source/test files under the Base UI 1.7.0 React package.
It found zero exact substantive three-line matches and zero exact 20-token shingles against either corpus.
This establishes that the checked files contain no copied textual block at those thresholds; it does not claim that generic lifecycle ideas are unique or that automated similarity can prove authorship.
No copied or substantially adapted upstream material was identified.

### Binary controls and toggles

The form-foundation migration extracts existing Base behavior into `src/FormAssociatedElement.ts`, `src/_checked-control.ts`, and `src/_native-field.ts`.
Reve's `FormAssociatedElement` and `FormFieldElement` were inspected for their separation of form mechanics from component-specific behavior; no Reve implementation or test code was copied or substantially adapted.
The new foundation tests and public type fixtures were written for Base's existing behavior and the new form-associated facade.
The public `FormAssociatedElement` does not adopt Reve's Lit dependency, property decorators, string-only field state, validation library, or field markup.

The authors attested independent implementation and tests, with Base UI used only to check observable behavior:

- Checkbox: `src/CheckboxElement.ts`, `test/browser/checkbox.test.ts`, and `design/checkbox.md`.
- Switch and Checkbox Group: `src/SwitchElement.ts`, `src/CheckboxGroupElement.ts`, `src/_checkbox-group.ts`, `test/browser/switch.test.ts`, `test/browser/checkbox-group.test.ts`, and `design/checkbox-group.md`.
- Toggle and Toggle Group: `src/ToggleElement.ts`, `src/ToggleGroupElement.ts`, `src/_toggle-group.ts`, `test/browser/toggle.test.ts`, `test/browser/toggle-group.test.ts`, and `design/toggle.md`.

The Checkbox author used the user-approved Base UI interaction pattern as a behavioral reference.
The Switch and Checkbox Group author checked Base UI's unchecked value and parent-checkbox disabled-item cycling behavior.
No implementation or test source was copied or substantially adapted.

### Tabs and Dialog

The authors attested independent native implementations and tests:

- Tabs: `src/TabsElement.ts` and `test/browser/tabs.test.ts`.
- Dialog: `src/DialogElement.ts` and `test/browser/dialog.test.ts`.

No Base UI or donor implementation or test source was copied or substantially adapted.

### Disclosure and selection

The authors attested independent implementation and tests against native behavior, local Base conventions, and the contracts named in the design documents:

- Disclosure: `src/_disclosure.ts`, `src/CollapsibleElement.ts`, `src/AccordionElement.ts`, `test/browser/collapsible.test.ts`, `test/browser/accordion.test.ts`, and `design/disclosure.md`.
- Selection core: `src/_selection.ts`, `src/_listbox.ts`, `src/_selection-field.ts`, `src/OptionElement.ts`, `src/AutocompleteElement.ts`, `src/ComboboxElement.ts`, `src/SelectElement.ts`, `test/browser/selection.test.ts`, and `design/selection.md`.
- Selection adversarial review: `test/browser/selection-adversarial.test.ts`.

The selection author consulted Base UI 1.7.0's `combobox/root/AriaCombobox.tsx`, `combobox/input/ComboboxInput.tsx`, `autocomplete/root/AutocompleteRoot.tsx`, and `select/root/SelectRoot.tsx` for behavior.
The donor informed option and selection vocabulary.
No source or test content was copied or substantially adapted.

### Native overlays and menus

The author attested independent implementation and tests from native platform behavior and the referenced product contracts:

- Overlay helpers and families: `src/_popover.ts`, `src/_hover-popover.ts`, `src/PopoverElement.ts`, `src/TooltipElement.ts`, `src/PreviewCardElement.ts`, `src/AlertDialogElement.ts`, `test/browser/popover.test.ts`, `test/browser/tooltip.test.ts`, `test/browser/preview-card.test.ts`, `test/browser/alert-dialog.test.ts`, and `design/overlays.md`.
- Composite and menu families: `src/_composite.ts`, `src/_menu.ts`, `src/MenuElement.ts`, `src/ContextMenuElement.ts`, `src/MenubarElement.ts`, `src/NavigationMenuElement.ts`, `src/ToolbarElement.ts`, the corresponding five browser test files, and `design/menus.md`.

No Base UI or donor implementation or test source was copied or substantially adapted.

### Field, numeric, and code entry

The authors attested independent implementation and tests from native-input contracts, local Base lifecycle patterns, and behavioral comparison:

- Field: `src/FieldElement.ts`, `test/browser/field.test.ts`, and `design/field.md`.
- Number Field: `src/NumberFieldElement.ts` and `test/browser/number-field.test.ts`.
- OTP Field: `src/OTPFieldElement.ts` and `test/browser/otp-field.test.ts`.
- Slider: `src/SliderElement.ts` and `test/browser/slider.test.ts`.
- Shared numeric helper and contract: `src/_numeric.ts` and `design/numeric.md`.

No Base UI or donor implementation or test source was copied or substantially adapted.

### Display

The author attests that `src/AvatarElement.ts`, `src/MeterElement.ts`, `src/ProgressElement.ts`, `src/SeparatorElement.ts`, their four browser test files, and `design/display.md` were independently implemented.
The donor supplied the Avatar migration use case, and Base UI supplied behavioral reference points.
No Base UI or donor implementation or test source was copied or substantially adapted.

### Transient surfaces and scrolling

The author attested independent implementation and tests from native dialog, timing, live-region, and scrolling behavior:

- `src/DrawerElement.ts`, `src/ToastRegionElement.ts`, and `src/ScrollAreaElement.ts`
- `test/browser/drawer.test.ts`, `test/browser/toast-region.test.ts`, and `test/browser/scroll-area.test.ts`
- `design/transient-and-scroll.md`

No Base UI or donor implementation or test source was copied or substantially adapted.

### Calendar and File

The author attested independent natural-DOM implementation and tests for `src/CalendarElement.ts`, `src/FileElement.ts`, `test/browser/calendar.test.ts`, `test/browser/file.test.ts`, and `design/calendar-and-files.md`.
File intentionally imports `observeDropTarget` from `@serve-tools/client-input` through that package's existing public contract.
No Base UI or donor implementation or test source was copied or substantially adapted.

## Integration, evidence, and documentation map

The root integration author attested independent authorship for the current gallery HTML, CSS, TypeScript modules, native-composition browser test, public export and type integration, README, Skills, and root planning documents.
These files were composed from the local Base contracts and public classes; no Base UI implementation or test source was copied.

The retention author independently wrote `design/retention.md` from first-party Chromium CDP experiments and positive controls.
The external reports under `/Users/jonathan/Documents/Codex/outputs/aui-retention-2026-08-27`, `/Users/jonathan/Documents/Codex/outputs/aui-validation-2026-08-28`, and `/Users/jonathan/Documents/Codex/outputs/aui-comparison-2026-08-28` likewise use public APIs and locally authored harnesses rather than copied upstream source.

Type-only consumer checks and Skill references were authored from the final local public API and the accepted design contracts.
They do not reproduce Base UI React types, examples, or documentation text.

## Ongoing rule

Behavioral comparison remains welcome and should cite the pinned source or documentation that defines the compared behavior.
Do not copy an implementation, test fixture, example, or substantial documentation passage merely because the upstream project is MIT licensed.
When adaptation is justified, record the exact upstream revision and path, the exact Base destination, what was retained, and the required license notice in this file before release.

## Final integration evidence

The final Checkbox fast paths and pre-connect tab-order correction extend the independently authored Checkbox implementation; the runtime author and separate reviewer both cleared the change.
The gallery, consumer documentation, final source-hash records, and results reconciliation were written locally from the implementation and its tests.
The final experimental harnesses remain outside the published package under `/Users/jonathan/Documents/Codex/outputs/aui-comparison-aggregate-2026-08-28` and `/Users/jonathan/Documents/Codex/outputs/aui-retention-2026-08-28`.
Their preserved earlier experiments and source snapshots support reproducibility; they do not change the bounded foundation-provenance caveat or introduce an upstream source adaptation into Base.
