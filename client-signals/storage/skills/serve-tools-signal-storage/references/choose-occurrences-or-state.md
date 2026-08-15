# Choose occurrences or state

- Use `subscribe()` when every `added`, `updated`, `removed`, or `invalidated` occurrence matters.
- Use `watch()` when consumers need a read-only Computed containing the latest string value or `null`.
- Expect signal consumers to coalesce intermediate changes.
  Do not use a watch as an event log.
