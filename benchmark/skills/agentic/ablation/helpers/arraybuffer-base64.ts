import type { ToBase64Options } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";
import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

/** Encodes exactly the selected typed-array view, retaining its offset and byte length. */
export function encodeView(value: ArrayBufferView, options?: ToBase64Options): string {
	return toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), options);
}
