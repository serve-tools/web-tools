import type { Handlers } from "../src/server-realtime.js";
import { createConnection } from "../src/server-realtime.js";

interface Protocol {
	requests: { identity(): string };
	subscriptions: { notices(): string };
}

interface Session {
	readonly userID: string;
}

const handlers = {
	requests: { identity: (_input, { connection }) => connection.userID },
	subscriptions: { notices: (_input, { emit }) => void emit("ready") },
} satisfies Handlers<Protocol, Session>;

/** A compile-tested sans-I/O server adapter recipe. */
export function serverRealtimeRecipe(send: (payload: ArrayBuffer) => void, session: Session) {
	return createConnection(handlers, { send, close: console.log }, session);
}
