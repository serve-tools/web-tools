# Preserve semantics

- Treat operation promises as settling after transaction commit, not merely after the request succeeds.
- Pass cancellation through the operation's `signal` option; do not place `AbortSignal` in stored values.
- Keep values structured-clone compatible.
- Close owned connections explicitly or with `await using` when the runtime supports `Symbol.dispose`.
- Handle version changes deliberately.
  Without a custom version-change handler, expect the connection to close when another context upgrades the database.
- Do not claim Node.js compatibility without providing an IndexedDB implementation in the application.
