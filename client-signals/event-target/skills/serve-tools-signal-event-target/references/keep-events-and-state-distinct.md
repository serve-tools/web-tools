# Keep events and state distinct

- Treat the signal as current state, not an occurrence log.
  Equal values do not invalidate dependents, and Signal consumers may coalesce intermediate changes.
- Use `addEventListener()` directly when every event or its payload must be processed.
- Do not try to call `set()`.
  Event-target-backed signals are read-only computed façades over source-owned state.
- Use `refresh()` only to reconcile state that may have changed without the configured event.
