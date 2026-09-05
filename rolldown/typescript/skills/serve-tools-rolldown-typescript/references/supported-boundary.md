# Use within its supported boundary

The compiler policy `~7.1.0-0` accepts stable `7.1.x` and 7.1.0 prereleases; only `7.1.0-dev.20260904.1` has executable validation so far.
Other minors and prereleases of later patches are excluded.

Use this experimental plugin for ordinary Vite development and production builds or direct Rolldown bundling of one configured referenced project graph.
It serves in-memory JavaScript and source maps while package exports and side-effect metadata continue to define public runtime imports.

Keep declarations, distributable artifacts, publishing, generated assets, and configuration-time code on the normal TypeScript CLI path.
Worker and asset URL query imports are outside the in-memory path.

The public plugin surface exposes its name and `api.dispose()` only.
Do not depend on compiler snapshots, refresh controls, watcher helpers, timing, or other internals.

Avoid treating absent disk writes as a performance claim.
The validation benchmark covers a small referenced fixture, not general application speed or memory use.
