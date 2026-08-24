import type { SignalDB } from "../src/signal-db.js";

interface AppSchema {
	notes: SignalDB.Store<{ title: string }, string>;
}

declare const db: SignalDB<AppSchema>;

export const note = db.watch("notes", "welcome");
export const noteKeys = db.watchAllKeys("notes", { count: 10 });
export const noteCount = db.watchCount("notes");
