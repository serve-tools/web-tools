import { connect, serve } from "@serve-tools/client-messaging";

type Echo = { requests: { echo(input: { text: string; delay: number }): string } };

export async function openDelayedEcho(wait: (delay: number, signal: AbortSignal) => PromiseLike<unknown> | unknown) {
	if (typeof wait !== "function") {
		throw new TypeError("Expected wait to be a function");
	}
	const channel = new MessageChannel();
	const server = serve<Echo>(channel.port1, {
		requests: {
			async echo(input, { signal }) {
				assertEcho(input);
				await wait(input.delay, signal);
				return input.text;
			},
		},
	});
	const client = connect<Echo>(channel.port2);
	await client.ready;
	return {
		echo(text: string, delay: number, signal?: AbortSignal): Promise<string> {
			if (signal !== undefined && !(signal instanceof AbortSignal)) {
				return Promise.reject(new TypeError("Invalid signal"));
			}
			return client.request("echo", { text, delay }, { signal });
		},
		close(reason?: unknown): void {
			client.close(reason);
			server.close(reason);
			channel.port1.close();
			channel.port2.close();
		},
		closed: Promise.all([client.closed, server.closed]).then(() => undefined),
	};
}

function assertEcho(value: unknown): asserts value is { text: string; delay: number } {
	if (typeof value !== "object" || value === null || Object.keys(value).length !== 2) {
		throw new TypeError("Expected echo input");
	}
	const input = value as { text: unknown; delay: unknown };
	if (
		typeof input.text !== "string" ||
		input.text.length === 0 ||
		!Number.isSafeInteger(input.delay) ||
		(input.delay as number) < 0
	) {
		throw new TypeError("Invalid echo input");
	}
}
