# @serve-tools/signal-db

`@serve-tools/signal-db` adds explicit Signal-backed query state to `@serve-tools/client-db`.

```ts
import { SignalDB } from "@serve-tools/signal-db";

await using db = await SignalDB.open<{ notes: SignalDB.Store<string, string> }>("notes");
using note = db.watch("notes", "welcome");
```

## Install

```shell
npm install @serve-tools/signal-db
```

`watch()` and `watchAll()` expose `pending`, `ready`, or `error` state and refresh when signal-backed inputs change.
Committed point writes and read/write transactions made through the same `SignalDB` automatically invalidate affected stores.
Call `invalidate()` after writes made through another connection or API because native IndexedDB does not broadcast record changes.
Use `@serve-tools/signal-shared-db` when multiple tabs need coordinated post-commit change subscriptions.

Finite operations, transactions, and scans retain the underlying client's Promise and IndexedDB semantics.
Dispose queries independently or close the wrapper to dispose every query and close its source connection.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-db`](./skills/serve-tools-signal-db/SKILL.md).

## License

[MIT-0](./LICENSE.md)
