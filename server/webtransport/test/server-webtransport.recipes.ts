import type { Handlers, SessionTransport } from "../src/server-webtransport.js";
import { createSession } from "../src/server-webtransport.js";

interface Protocol {
	requests: { identity(): string };
	datagrams: {
		cursor: { client: { x: number; y: number }; server: { x: number; y: number } };
	};
}

interface Context {
	readonly userID: string;
}

const handlers = {
	requests: { identity: (_input, { connection }) => connection.userID },
	datagrams: { cursor: (value, { datagrams }) => datagrams.write("cursor", value) },
} satisfies Handlers<Protocol, Context>;

/** A compile-tested sans-I/O WebTransport session recipe. */
export const serverWebTransportRecipe = (transport: SessionTransport, context: Context) =>
	createSession(handlers, transport, context);
