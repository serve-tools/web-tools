import { test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { deserialize, serialize } from "../src/lib/.serialization.js";

const objectValue = {
	name: "websocket",
	items: Array.from({ length: 100 }, (_, index) => ({ index, active: index % 2 === 0 })),
};
const binaryValue = {
	metadata: objectValue,
	bytes: crypto.getRandomValues(new Uint8Array(64 * 1024)),
};
const largeBuffer = new ArrayBuffer(1024 * 1024);
const objectPayload = serialize(objectValue);
const binaryPayload = serialize(binaryValue);
const largePayload = serialize(largeBuffer);

test("structured serialization", async () => {
	await benchmark(
		"client-websocket/serialize-object",
		() => {
			serialize(objectValue);
		},
		{ iterations: 10_000 },
	);
	await benchmark(
		"client-websocket/deserialize-object",
		() => {
			deserialize(objectPayload);
		},
		{ iterations: 10_000 },
	);
	await benchmark(
		"client-websocket/serialize-64-kib",
		() => {
			serialize(binaryValue);
		},
		{ iterations: 1_000 },
	);
	await benchmark(
		"client-websocket/deserialize-64-kib",
		() => {
			deserialize(binaryPayload);
		},
		{ iterations: 1_000 },
	);
	await benchmark(
		"client-websocket/serialize-1-mib",
		() => {
			serialize(largeBuffer);
		},
		{ iterations: 100 },
	);
	await benchmark(
		"client-websocket/deserialize-1-mib",
		() => {
			deserialize(largePayload);
		},
		{ iterations: 100 },
	);
});
