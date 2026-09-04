import { deserialize } from "@serve-tools/realtime-protocol";
import { FrameDecoder } from "@serve-tools/realtime-protocol/stream";

export function decodeAuditChunks(chunks: Uint8Array[]): unknown[] {
	if (
		!Array.isArray(chunks) ||
		Array.from({ length: chunks.length }, (_, index) => !Object.hasOwn(chunks, index)).some(Boolean)
	) {
		throw new TypeError("chunks must be a dense Array");
	}

	const decoder = new FrameDecoder();
	const values: unknown[] = [];
	for (const chunk of chunks) {
		if (!(ArrayBuffer.isView(chunk) && Object.prototype.toString.call(chunk) === "[object Uint8Array]")) {
			throw new TypeError("chunks must contain Uint8Array values");
		}
		for (const payload of decoder.push(chunk)) {
			values.push(deserialize(payload));
		}
	}
	decoder.finish();
	return values;
}
