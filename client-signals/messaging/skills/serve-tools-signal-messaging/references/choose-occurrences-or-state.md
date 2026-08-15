# Choose occurrences or state

- Use the messaging client's `subscribe()` when every occurrence must be processed.
- Use `observe()` when consumers need the latest subscription state through a read-only Signal.
- Keep finite messaging requests as Promises.
- Expect Signal consumers to coalesce intermediate ready values.
  Do not treat an observation as an event log.
