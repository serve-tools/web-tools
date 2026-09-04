import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";

/** Decodes a sequence of independently framed payloads, rejecting a truncated final frame. */
export function decodeFrames(chunks: Iterable<ArrayBufferView>): ArrayBuffer[] {
	const decoder = new FrameDecoder();
	const values: ArrayBuffer[] = [];

	for (const chunk of chunks) {
		values.push(...decoder.push(chunk));
	}
	decoder.finish();
	return values;
}

/** Encodes one payload for a client or server HTTP stream. */
export const frame = encodeFrame;
