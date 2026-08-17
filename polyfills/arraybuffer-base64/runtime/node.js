import { toBase64 as encodeBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

if (Uint8Array.prototype.toBase64 === undefined) {
	const toBase64 = function toBase64(options) {
		return encodeBase64(this, options);
	};
	Object.defineProperty(toBase64, "length", { value: 0 });

	Object.defineProperty(Uint8Array.prototype, "toBase64", {
		configurable: true,
		writable: true,
		value: toBase64,
	});
}
