import { deserialize } from "@serve-tools/realtime-protocol";
import { FrameDecoder } from "@serve-tools/realtime-protocol/stream";

export function decodeAuditChunks(chunks: readonly Uint8Array[]): unknown[] {
	if (!Array.isArray(chunks)) {
		throw new TypeError("Expected chunks");
	}

	const decoder = new FrameDecoder();
	const values: unknown[] = [];

	for (let index = 0; index < chunks.length; ++index) {
		const chunk = chunks[index];

		if (!(index in chunks) || !(chunk instanceof Uint8Array)) {
			throw new TypeError("Expected Uint8Array chunks");
		}

		for (const payload of decoder.push(chunk)) {
			values.push(deserialize(payload));
		}
	}

	decoder.finish();

	return values;
}
