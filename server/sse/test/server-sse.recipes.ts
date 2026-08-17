import type { Handlers } from "../src/server-sse.js";
import { createHandler } from "../src/server-sse.js";

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

/** A compile-tested authorized Fetch handler recipe. */
export const serverSSERecipe = () =>
	createHandler(handlers, {
		authorize: (request) => ({ userID: request.headers.get("authorization") ?? "anonymous" }),
	});
