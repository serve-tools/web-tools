import type { Handlers } from "../src/server-http-stream.js";
import { createHandler } from "../src/server-http-stream.js";

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
export const serverHTTPStreamRecipe = () =>
	createHandler(handlers, {
		authorize: (request) => ({ userID: request.headers.get("authorization") ?? "anonymous" }),
	});
