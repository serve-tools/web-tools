# Preserve refresh semantics

- Treat `query.refresh()` as resolving after the latest refresh requested so far has published, including overlapping refreshes.
- Expect refresh cancellation and read failure to publish an `error` state rather than reject the refresh call.
- Use `query.refresh()` for one query and `db.invalidate(...stores)` for every active query over selected stores.
- Let mutations routed through the shared client invalidate affected queries automatically.
