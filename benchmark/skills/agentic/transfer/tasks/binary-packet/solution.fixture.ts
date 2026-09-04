import { toBase64 } from "@serve-tools/ponyfill-arraybuffer-base64/runtime/node";

const maximumLength = 65_535;

export function encodePacket(payload: Uint8Array): string {
	if (!(payload instanceof Uint8Array) || payload.byteLength > maximumLength) {
		throw new TypeError("Invalid packet payload");
	}

	const packet = new Uint8Array(5 + payload.byteLength);
	const view = new DataView(packet.buffer);

	packet[0] = 1;
	view.setUint32(1, payload.byteLength, false);
	packet.set(payload, 5);

	return toBase64(packet, { alphabet: "base64url", omitPadding: true });
}

export function decodePacket(token: string): Uint8Array {
	if (typeof token !== "string" || token.includes("=") || !/^[A-Za-z0-9_-]*$/.test(token)) {
		throw new TypeError("Invalid packet encoding");
	}

	const packet = new Uint8Array(Buffer.from(token, "base64url"));

	if (toBase64(packet, { alphabet: "base64url", omitPadding: true }) !== token || packet.byteLength < 5) {
		throw new TypeError("Invalid packet encoding");
	}
	if (packet[0] !== 1) {
		throw new TypeError("Unsupported packet version");
	}

	const length = new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getUint32(1, false);

	if (length > maximumLength || length !== packet.byteLength - 5) {
		throw new TypeError("Invalid packet length");
	}

	return packet.slice(5);
}
