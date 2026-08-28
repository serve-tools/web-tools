# Calendar and files

`CalendarElement` is an inline, non-form-associated Gregorian plain-date grid.
Its `value` is an ISO `YYYY-MM-DD` string or the empty string, and its `month` is an ISO `YYYY-MM` string.
`min`, `max`, `locale`, `disabled`, and explicit `weekStartsOn` constrain or present the current grid without giving it a hidden date input, picker, or form value.
Calendar uses localized `Intl` labels, native buttons in a grid, retained 42-day cells, UTC arithmetic, and cancelable user proposals before `input` and `change`.
The shadow grid owns one weekday row and six date rows, with stable `grid`, `weekdays`, `weekday`, `row`, `day`, `today`, `selected`, and `outside` parts for author styling.
Retained cells outside years `0000` through `9999` are disabled and have no ISO value, while year-zero labels include an era to avoid presenting it as AD 1.
`select()` and `showMonth()` are silent programmatic operations, and `focusDate` owns grid keyboard navigation.

`FileElement` is a non-form-associated wrapper around exactly one direct authored `input[type=file]`.
That input remains the only label target, focus target, picker, validation target, form entry, reset participant, and authority for `name`, `form`, `accept`, `multiple`, `required`, and `disabled`.
The wrapper exposes that input as `input`, provides a frozen `files` snapshot, permits silent native `DataTransfer` assignment, and provides `pick()` and `refresh()`.
`maxSize` is an optional wrapper constraint, while native picker `accept` remains advisory and never a security guarantee.
Dropped or programmatically assigned batches use the authored `accept` tokens as an explicit UX filter, but this cannot prove a file's content type or constrain a native picker.
Dropped files are proposed through cancelable `beforechange`, atomically validated for count and size, then assigned to the actual input before its actual `input` and `change` events are emitted.
Native picker cancellation and platform-native picker editing keep their browser behavior, so tests do not claim to prove an operating-system chooser.
