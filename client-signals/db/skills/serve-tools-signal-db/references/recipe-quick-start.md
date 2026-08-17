# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-db.recipes.ts` fixture in the package source.

```ts
import type { SignalDB } from "@serve-tools/signal-db";

interface AppSchema {
	notes: SignalDB.Store<{ title: string }, string>;
}

declare const db: SignalDB<AppSchema>;

export const note = db.watch("notes", "welcome");
```
