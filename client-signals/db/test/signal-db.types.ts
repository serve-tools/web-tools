import type { SignalDB } from "../src/signal-db.js";

declare const db: SignalDB<{ notes: SignalDB.Store<string, string> }>;

const note = db.watch("notes", "one");
const noteKeys = db.watchAllKeys("notes", { count: 1, query: "one" });
const noteCount = db.watchCount("notes", { query: "one" });
const state = note.get();
const value: string | undefined = state.status === "ready" ? state.value : undefined;

// @ts-expect-error key must match the store schema
db.watch("notes", 1);

// @ts-expect-error key query must match the store schema
db.watchCount("notes", { query: 1 });

void noteKeys;
void noteCount;
void value;
