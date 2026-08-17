import type { SignalDB } from "../src/signal-db.js";

declare const db: SignalDB<{ notes: SignalDB.Store<string, string> }>;

const note = db.watch("notes", "one");
const state = note.get();
const value: string | undefined = state.status === "ready" ? state.value : undefined;

// @ts-expect-error key must match the store schema
db.watch("notes", 1);

void value;
