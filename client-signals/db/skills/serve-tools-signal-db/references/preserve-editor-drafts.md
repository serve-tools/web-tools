# Preserve editor drafts during query refresh

Each refresh publishes `pending` without the previous value, in both direct and shared signal databases.
A refresh after a committed write is not a confirmed empty result.
Replacing the editor with a loading branch can destroy its textarea and unsent draft.

Copy the application-local `retainQuerySnapshot` and `mountDraftEditor` helpers from the [compile-checked recipe](recipe-quick-start.md).
These are recipe functions, not new exports from this package.
They use `@serve-tools/signal` and `@serve-tools/signal-effect`; declare both as direct application dependencies when copying them.

The retained state has two independent fields:

- `current` is the query's latest observed `pending`, `ready`, or `error` state.
- `snapshot` is the last observed ready-state object, or `undefined` before any success.

Read the wrapper's presence, not the truthiness of its value.
A successful `undefined`, empty array, zero, `false`, or `null` replaces the previous snapshot.
A ready `undefined` for a record means it is missing; the example removes the editor then, instead of keeping deleted data visible.
`pending` and `error` leave the last success intact.
Show errors even when a snapshot exists, rather than presenting stale data as a fresh success.

The example mounts its textarea once and changes only the server-owned heading during refresh.
The unsent draft belongs to that editor, not to the query result.
For framework rendering, preserve the same component identity/key and keep draft state independent of the fetched record.
Retaining a snapshot cannot preserve a draft if the renderer still replaces the element or overwrites its value on every update.

Create the owner once for one fixed logical record or result set, outside render/effect callbacks.
Use a static record key for an editor.
Dispose and recreate the owner when its key, filters, account, permissions, or tenant change.
Do not reuse one retained cache with reactive query parameters across those boundaries: `QueryState` does not identify which request produced its value.
If drafts must survive changing records or successful deletion, give them a separate application-owned store with an explicit persistence policy.

Stop the renderer first, then the retention effect, then its owned query.
The returned `dispose` method does that and removes only the DOM created by this editor.
If the title callback throws during initial mounting, the helper also cleans up its effects, query, and partial DOM before rethrowing.
The retired view intentionally freezes; do not leave it mounted as an apparently live refreshing view.
Closing the database remains the responsibility of the owner that created it, and shared-worker ports still belong to their creating page.

The recipe is exercised with real IndexedDB queries and, for the shared package, a committed update from another SharedWorker client.
Controlled refreshes verify initial loading, retained DOM/focus/drafts, visible errors after success, successful empty/missing results, and terminal disposal without late publication.
