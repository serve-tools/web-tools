import { MessageChannel } from "node:worker_threads";
import { connect, serve } from "@serve-tools/client-messaging";

interface EchoProtocol {
	requests: { echo(input: { text: string; delay: number }): Promise<string> };
}

const validate = (input: { text: string; delay: number }) => {
	if (
		!input ||
		typeof input.text !== "string" ||
		!input.text ||
		!Number.isSafeInteger(input.delay) ||
		input.delay < 0
	) {
		throw new TypeError("input");
	}
};

export async function openDelayedEcho(wait: (delay: number, signal: AbortSignal) => void | Promise<void>) {
	if (typeof wait !== "function") {
		throw new TypeError("wait");
	}
	const channel = new MessageChannel();
	const server = serve<EchoProtocol>(channel.port1, {
		requests: {
			async echo(input, { signal }) {
				validate(input);
				await wait(input.delay, signal);
				return input.text;
			},
		},
	});
	const client = connect<EchoProtocol>(channel.port2);
	await client.ready;

	return {
		echo(text: string, delay: number, signal?: AbortSignal) {
			if (signal !== undefined && !(signal instanceof AbortSignal)) {
				return Promise.reject(new TypeError("signal"));
			}
			return client.request("echo", { text, delay }, { signal });
		},
		close(reason?: unknown) {
			client.close(reason);
			server.close(reason);
			channel.port1.close();
			channel.port2.close();
		},
		closed: Promise.all([client.closed, server.closed]).then(() => {}),
	};
}
