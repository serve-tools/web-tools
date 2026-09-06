# Compose calendars and file controls

Register `CalendarElement` from `@serve-tools/base-components/calendar` or `FileElement` from `@serve-tools/base-components/file` under an application tag name.
Neither host is form-associated.

For a calendar, set `value="2026-08-28"`, `month="2026-08"`, and any ISO `min` or `max` bounds on the host.
Use `locale` for localized Gregorian labels and `weekStartsOn` from 0 through 6 for an explicit first weekday.
`value` or `select()` silently changes selection; `month` or `showMonth()` silently changes the visible month; `focusDate` targets the real grid button.
Listen for `beforechange` to veto a user selection before its `input` and `change` events.
Read the proposed ISO date from the immutable detail and do not mutate the proposal object.
Style the documented grid, row, day, selected, today, and outside parts rather than reaching into the shadow root.
The calendar is not a picker, hidden input, form value, or range-selection API.

For files, keep exactly one direct `<input type="file" name="attachments">` inside the host.
Put `accept`, `multiple`, `required`, `disabled`, native labels, and form association on that input.
Field can use the wrapper's bounded readonly `input` adapter while the native input remains the actual control.
Read `files` as a frozen snapshot or assign a readonly File array silently; programmatic assignment uses native DataTransfer and preserves the old selection when a batch fails the configured constraints.
Use `maxSize` or `max-size` for a per-file byte limit and `refresh()` after silent native file or custom-validity changes.
`pick()` invokes the native chooser through the input; it does not return a success or cancellation promise.

Drops emit cancelable `beforechange` with immutable `files` and the source DragEvent before committing.
Accepted drops update the real input and emit its `input` and `change` events only while the transaction remains current.
Native picker edits are already committed when input events fire and cannot use that precommit contract.
`accept` is a convenience filter for assigned or dropped files and an advisory picker hint, never a file-content security check.
Do not upload, read, or publish file contents merely to show a selected filename.
