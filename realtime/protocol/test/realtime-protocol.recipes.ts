import { deserialize, isClientMessage, serialize } from "../src/realtime-protocol.js";
import { encodeFrame, FrameDecoder } from "../src/stream.js";

/** A compile-tested structured value, protocol guard, and reliable-stream framing recipe. */
export function realtimeProtocolRecipe(value: unknown): unknown[] {
	const frame = encodeFrame(serialize(value));
	const decoder = new FrameDecoder();

	return decoder
		.push(frame)
		.map((payload) => deserialize(payload, { maximumArrayBufferLength: 16 * 1024 * 1024 }))
		.filter(isClientMessage);
}
