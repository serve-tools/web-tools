import { connect } from "@serve-tools/client-http-stream";
import { createHandler } from "@serve-tools/server-http-stream";

interface IdentityProtocol {
	requests: { whoami(): string };
	subscriptions: {};
}

export function createIdentityClient(): { lookup(token: string): Promise<string>; close(): void } {
	const handler = createHandler<IdentityProtocol, { token: string }>(
		{
			requests: { whoami: (_input, { connection }) => connection.token },
			subscriptions: {},
		},
		{
			authorize(request) {
				const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");

				if (!match) {
					return new Response("Unauthorized", { status: 401 });
				}

				return { token: match[1] };
			},
		},
	);
	const makeClient = (token: string) =>
		connect<IdentityProtocol>("https://local/identity", {
			headers: { Authorization: `Bearer ${token}` },
			fetch: (input, init) => handler(new Request(input, init)),
		});
	const clients = new Set<ReturnType<typeof makeClient>>();
	let closed = false;

	return {
		async lookup(token) {
			if (closed) {
				throw Object.assign(new Error("The identity client is closed"), { name: "ConnectionClosedError" });
			}

			const client = makeClient(token);

			clients.add(client);

			return await client.request("whoami");
		},
		close() {
			if (closed) {
				return;
			}

			closed = true;

			for (const client of clients) {
				client.close();
			}

			clients.clear();
			handler.close();
		},
	};
}
