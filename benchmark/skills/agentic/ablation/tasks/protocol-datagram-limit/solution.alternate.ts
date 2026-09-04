import { decodeDatagram } from "@serve-tools/realtime-protocol/datagram";

export function readMeter(bytes: ArrayBuffer | ArrayBufferView, maximumArrayBufferLength: number): number {
	const { kind, value } = decodeDatagram(bytes, { maximumArrayBufferLength });
	const enumerableKeys =
		value !== null && typeof value === "object"
			? Reflect.ownKeys(value).filter((key) => Object.prototype.propertyIsEnumerable.call(value, key))
			: [];
	if (
		kind !== 7 ||
		value === null ||
		typeof value !== "object" ||
		enumerableKeys.length !== 1 ||
		enumerableKeys[0] !== "payload" ||
		!Object.prototype.propertyIsEnumerable.call(value, "payload") ||
		!((value as { payload?: unknown }).payload instanceof ArrayBuffer)
	) {
		throw new TypeError("Expected meter datagram payload");
	}

	return (value as { payload: ArrayBuffer }).payload.byteLength;
}
