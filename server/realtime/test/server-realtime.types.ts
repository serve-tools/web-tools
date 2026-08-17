import type { ProtocolType } from "@serve-tools/realtime-protocol";
import type { Handlers } from "../src/server-realtime.js";
import { createConnection } from "../src/server-realtime.js";

interface ChatProtocol {
	requests: {
		greet(name: string): string;
		ping(): void;
	};
	subscriptions: {
		messages(room: string): { body: string };
	};
}

interface Session {
	readonly user: string;
}

const handlers = {
	requests: {
		greet: (name, { connection, signal }) => `${connection.user}:${name}:${signal.aborted}`,
		ping: (_input, { connection }) => void connection.user,
	},
	subscriptions: {
		messages: (_room, { emit, complete, error, connection }) => {
			emit({ body: connection.user });
			complete();
			error(new Error("late"));
		},
	},
} satisfies Handlers<ChatProtocol, Session>;

const connection = createConnection<ChatProtocol, Session>(handlers, { send() {}, close() {} }, { user: "ada" });
const fail: (reason?: unknown) => void = connection.fail;

// @ts-expect-error server failures are reported automatically, not through connection options
createConnection(handlers, { send() {}, close() {} }, { user: "ada" }, { reportError: () => undefined });

export type InferredProtocol = ProtocolType<typeof connection>;

// @ts-expect-error every declared handler is required
const incomplete: Handlers<ChatProtocol, Session> = { requests: handlers.requests };

export { connection, fail, handlers, incomplete };
