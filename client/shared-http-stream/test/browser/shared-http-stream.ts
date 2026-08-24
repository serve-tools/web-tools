/// <reference lib="webworker" />

import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { contentType, streamContentType } from "@serve-tools/realtime-protocol/http-stream";
import { encodeFrame } from "@serve-tools/realtime-protocol/stream";
import { listen } from "../../src/lib/scope/shared-worker.js";

type Subscription = { readonly controller: ReadableStreamDefaultController<Uint8Array>; readonly id: number };

const subscriptions = new Set<Subscription>();

const response = (id: number, value: unknown): Response =>
	new Response(serialize([protocol, "resolve", id, value]), { headers: { "Content-Type": contentType } });

const fetcher: typeof fetch = async (_input, init) => {
	const request = deserialize(init?.body as ArrayBuffer) as [string, string, number, string, unknown];
	const [, kind, id, name, input] = request;

	if (kind === "request") {
		if (name === "subscriberCount") {
			return response(id, subscriptions.size);
		}
		if (name === "sourceCount") {
			return response(id, 1);
		}
		if (name === "emit") {
			for (const subscription of subscriptions) {
				subscription.controller.enqueue(encodeFrame(serialize([protocol, "event", subscription.id, input])));
			}

			return response(id, subscriptions.size);
		}
	}

	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				const subscription = { controller, id };

				subscriptions.add(subscription);
				init?.signal?.addEventListener(
					"abort",
					() => {
						subscriptions.delete(subscription);
						controller.close();
					},
					{ once: true },
				);
			},
		}),
		{ headers: { "Content-Type": streamContentType } },
	);
};

interface TestProtocol {
	requests: {
		sourceCount(): number;
		subscriberCount(): number;
		emit(value: number): number;
	};
	subscriptions: { values(): number };
}

const server = listen<TestProtocol>("https://loopback.test/realtime", { fetch: fetcher });

export type TestProtocolType = listen.ProtocolType<typeof server>;
