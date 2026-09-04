import { decodeDatagram } from "@serve-tools/realtime-protocol/datagram";

export function readMeter(bytes: Uint8Array, maximumArrayBufferLength: number): number {
	const value = decodeDatagram(bytes, { maximumArrayBufferLength });

	if (
		value.kind !== 7 ||
		typeof value.value !== "object" ||
		value.value === null ||
		Object.keys(value.value).length !== 1 ||
		!Object.hasOwn(value.value, "payload") ||
		!((value.value as { payload: unknown }).payload instanceof ArrayBuffer)
	) {
		throw new TypeError("Invalid meter datagram");
	}

	return (value.value as { payload: ArrayBuffer }).payload.byteLength;
}
