const maximumUnsignedInteger = 0xffff_ffff;

/** The default maximum payload accepted by a stream frame decoder. */
export const defaultMaximumFrameLength = 16 * 1024 * 1024;

/** Encodes one payload with a four-byte, unsigned, big-endian length prefix. */
export const encodeFrame = (payload: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> => {
	const bytes = ArrayBuffer.isView(payload)
		? new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
		: new Uint8Array(payload);

	if (bytes.byteLength > maximumUnsignedInteger) {
		throw new RangeError("The frame payload exceeds the 32-bit length prefix");
	}

	const frame = new Uint8Array(bytes.byteLength + 4);

	frame[0] = bytes.byteLength >>> 24;
	frame[1] = bytes.byteLength >>> 16;
	frame[2] = bytes.byteLength >>> 8;
	frame[3] = bytes.byteLength;
	frame.set(bytes, 4);

	return frame;
};

/** Incrementally decodes length-prefixed payloads from a reliable byte stream. */
export class FrameDecoder {
	readonly #maximumFrameLength: number;
	#buffer = new Uint8Array(0);
	#start = 0;
	#end = 0;
	#expectedLength: number | undefined;

	constructor(maximumFrameLength = defaultMaximumFrameLength) {
		if (
			!Number.isSafeInteger(maximumFrameLength) ||
			maximumFrameLength < 0 ||
			maximumFrameLength > maximumUnsignedInteger
		) {
			throw new RangeError("The maximum frame length must be a 32-bit unsigned integer");
		}

		this.#maximumFrameLength = maximumFrameLength;
	}

	/** Pushes the next stream chunk and returns every complete payload it contains. */
	push(chunk: ArrayBuffer | ArrayBufferView): ArrayBuffer[] {
		const bytes = ArrayBuffer.isView(chunk)
			? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
			: new Uint8Array(chunk);

		this.#append(bytes);

		const payloads: ArrayBuffer[] = [];

		while (true) {
			if (this.#expectedLength === undefined) {
				if (this.#end - this.#start < 4) {
					break;
				}

				this.#expectedLength =
					this.#buffer[this.#start] * 0x100_0000 +
					(this.#buffer[this.#start + 1] << 16) +
					(this.#buffer[this.#start + 2] << 8) +
					this.#buffer[this.#start + 3];
				this.#start += 4;

				if (this.#expectedLength > this.#maximumFrameLength) {
					this.reset();

					throw new RangeError("The stream frame exceeds the configured maximum length");
				}
			}

			if (this.#end - this.#start < this.#expectedLength) {
				break;
			}

			const end = this.#start + this.#expectedLength;
			const payload = this.#buffer.slice(this.#start, end);

			payloads.push(payload.buffer);
			this.#start = end;
			this.#expectedLength = undefined;
		}

		this.#compact();

		return payloads;
	}

	/** Verifies that an ended stream did not truncate a frame. */
	finish(): void {
		if (this.#end !== this.#start || this.#expectedLength !== undefined) {
			this.reset();

			throw new RangeError("The stream ended with an incomplete frame");
		}
	}

	/** Discards every incomplete frame. */
	reset(): void {
		this.#start = 0;
		this.#end = 0;
		this.#expectedLength = undefined;
	}

	#append(bytes: Uint8Array): void {
		const available = this.#end - this.#start;
		const required = available + bytes.byteLength;

		if (required > this.#buffer.byteLength) {
			let capacity = Math.max(8, this.#buffer.byteLength);

			while (capacity < required) {
				capacity *= 2;
			}

			const buffer = new Uint8Array(capacity);

			buffer.set(this.#buffer.subarray(this.#start, this.#end));
			this.#buffer = buffer;
			this.#start = 0;
			this.#end = available;
		} else if (this.#start > 0 && this.#buffer.byteLength - this.#end < bytes.byteLength) {
			this.#buffer.copyWithin(0, this.#start, this.#end);
			this.#start = 0;
			this.#end = available;
		}

		this.#buffer.set(bytes, this.#end);
		this.#end += bytes.byteLength;
	}

	#compact(): void {
		if (this.#start === this.#end) {
			this.#start = 0;
			this.#end = 0;
		} else if (this.#start > this.#buffer.byteLength / 2) {
			this.#buffer.copyWithin(0, this.#start, this.#end);
			this.#end -= this.#start;
			this.#start = 0;
		}
	}
}
