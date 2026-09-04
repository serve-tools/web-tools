import { connect } from "@serve-tools/client-http-stream";
import { createHandler } from "@serve-tools/server-http-stream";

interface IdentityProtocol {
	requests: { whoami(): string };
}

export function createIdentityClient(): { lookup: (token: string) => Promise<string>; close: () => void } {
	const handler = createHandler<IdentityProtocol, string>(
		{
			requests: { whoami: (_input, { connection }) => connection },
		},
		{
			authorize(request) {
				const authorization = request.headers.get("authorization");
				const match = /^Bearer (.+)$/u.exec(authorization ?? "");
				return match ? match[1]! : new Response(null, { status: 401 });
			},
		},
	);
	const clients = new Set<ReturnType<typeof connect<IdentityProtocol>>>();
	let closed = false;

	const lookup = async (token: string): Promise<string> => {
		if (closed) {
			throw new DOMException("The client is closed", "InvalidStateError");
		}

		const client = connect<IdentityProtocol>("https://identity.invalid/whoami", {
			headers: { Authorization: `Bearer ${token}` },
			fetch: (input, init) => handler(new Request(input, init)),
		});
		clients.add(client);

		try {
			return await client.request("whoami");
		} finally {
			client.close();
			clients.delete(client);
		}
	};
	const close = (): void => {
		if (closed) {
			return;
		}
		closed = true;
		for (const client of clients) {
			client.close();
		}
		clients.clear();
		handler.close();
	};

	return { lookup, close };
}
