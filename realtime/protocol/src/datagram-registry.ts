import { deserialize, protocol, serialize } from "./realtime-protocol.js";
import { encodeFrame, FrameDecoder } from "./stream.js";

type RegisterMessage = readonly [protocol: string, type: "register", request: number, name: string];
type RegisteredMessage = readonly [protocol: string, type: "registered", request: number, kind: number];
type RegistryMessage = RegisterMessage | RegisteredMessage;

const textEncoder = new TextEncoder();

/** Default maximum number of distinct datagram names accepted from one peer. */
export const defaultMaximumPeerRegistrations = 256;

/** Default maximum UTF-8 byte length of one datagram registration name. */
export const defaultMaximumDatagramRegistryNameLength = 256;

/** Default maximum payload length of one framed datagram registry control message. */
export const defaultMaximumDatagramRegistryControlFrameLength = 4 * 1024;

/** Resource limits for one connection-local datagram registry. */
export interface DatagramRegistryOptions {
	/** Maximum number of distinct datagram names accepted from the peer. Defaults to 256. */
	readonly maximumPeerRegistrations?: number;

	/** Maximum UTF-8 byte length of one registration name. Defaults to 256. */
	readonly maximumNameLength?: number;

	/** Maximum payload length of one framed registry control message. Defaults to 4 KiB. */
	readonly maximumControlFrameLength?: number;
}

/** Coordinates connection-local datagram names and numeric identifiers with a remote peer. */
export class DatagramRegistry {
	readonly #send: (payload: Uint8Array<ArrayBuffer>) => void;
	readonly #decoder: FrameDecoder;
	readonly #maximumNameLength: number;
	readonly #maximumControlFrameLength: number;
	readonly #maximumPeerRegistrations: number;
	readonly #incomingNames = new Map<number, string>();
	readonly #incomingKinds = new Map<string, number>();
	readonly #outgoing = new Map<string, Promise<number>>();
	readonly #pending = new Map<number, ReturnType<typeof Promise.withResolvers<number>>>();
	#nextRequest = 0;

	/** Creates a registry that sends framed registration messages through the provided callback. */
	constructor(send: (payload: Uint8Array<ArrayBuffer>) => void, options?: DatagramRegistryOptions) {
		this.#send = send;
		const maximumPeerRegistrations = options?.maximumPeerRegistrations ?? defaultMaximumPeerRegistrations;
		const maximumNameLength = options?.maximumNameLength ?? defaultMaximumDatagramRegistryNameLength;
		const maximumControlFrameLength =
			options?.maximumControlFrameLength ?? defaultMaximumDatagramRegistryControlFrameLength;

		if (!Number.isSafeInteger(maximumPeerRegistrations) || maximumPeerRegistrations < 1) {
			throw new RangeError("The maximum peer registrations must be a positive safe integer");
		}
		if (!Number.isSafeInteger(maximumNameLength) || maximumNameLength < 1) {
			throw new RangeError("The maximum registration name length must be a positive safe integer");
		}
		if (!Number.isSafeInteger(maximumControlFrameLength) || maximumControlFrameLength < 1) {
			throw new RangeError("The maximum registry control frame length must be a positive safe integer");
		}

		this.#decoder = new FrameDecoder(maximumControlFrameLength);
		this.#maximumPeerRegistrations = maximumPeerRegistrations;
		this.#maximumNameLength = maximumNameLength;
		this.#maximumControlFrameLength = maximumControlFrameLength;
	}

	/** Returns the peer-registered name associated with a connection-local datagram identifier. */
	name(kind: number): string | undefined {
		return this.#incomingNames.get(kind);
	}

	/** Registers a local datagram name and resolves with the peer-assigned identifier. */
	register(name: string): Promise<number> {
		this.#validateName(name);

		const registration = this.#outgoing.get(name);

		if (registration) {
			return registration;
		}

		if (this.#nextRequest >= Number.MAX_SAFE_INTEGER) {
			return Promise.reject(new RangeError("The datagram registry exhausted its request IDs"));
		}

		const request = ++this.#nextRequest;
		const pending = Promise.withResolvers<number>();

		this.#pending.set(request, pending);

		this.#outgoing.set(name, pending.promise);

		try {
			this.#sendMessage([protocol, "register", request, name] satisfies RegisterMessage);
		} catch (error) {
			this.#pending.delete(request);
			this.#outgoing.delete(name);

			throw error;
		}

		return pending.promise;
	}

	/** Processes a chunk from the reliable datagram-registration control stream. */
	receive(chunk: ArrayBuffer | ArrayBufferView): void {
		for (const frame of this.#decoder.push(chunk)) {
			const message = deserialize(frame, { maximumArrayBufferLength: 0 });

			if (!isRegistryMessage(message)) {
				throw new TypeError("Invalid datagram registry message");
			}

			if (message[1] === "register") {
				this.#validateName(message[3]);

				let kind = this.#incomingKinds.get(message[3]);

				if (kind === undefined) {
					if (this.#incomingKinds.size >= this.#maximumPeerRegistrations) {
						throw new RangeError("The datagram registry exceeds the configured peer registration limit");
					}

					kind = this.#incomingKinds.size + 1;

					if (kind > 0xffff_ffff) {
						throw new RangeError("The datagram registry exhausted its kind IDs");
					}

					this.#incomingKinds.set(message[3], kind);
					this.#incomingNames.set(kind, message[3]);
				}

				this.#sendMessage([protocol, "registered", message[2], kind] satisfies RegisteredMessage);
			} else {
				const pending = this.#pending.get(message[2]);

				if (!pending) {
					throw new TypeError("Unknown datagram registration response");
				}

				this.#pending.delete(message[2]);

				pending.resolve(message[3]);
			}
		}
	}

	/** Verifies that the registration control stream ended on a complete frame. */
	finish(): void {
		this.#decoder.finish();
	}

	/** Rejects every pending local datagram registration with the supplied failure. */
	fail(reason: unknown): void {
		for (const pending of this.#pending.values()) {
			pending.reject(reason);
		}

		this.#pending.clear();
	}

	#sendMessage(message: RegistryMessage): void {
		const frame = encodeFrame(serialize(message));

		if (frame.byteLength - 4 > this.#maximumControlFrameLength) {
			throw new RangeError("The datagram registry control frame exceeds the configured maximum length");
		}

		this.#send(frame);
	}

	#validateName(name: string): void {
		if (name.length > this.#maximumNameLength || textEncoder.encode(name).byteLength > this.#maximumNameLength) {
			throw new RangeError("The datagram registration name exceeds the configured maximum length");
		}
	}
}

const isRegistryMessage = (value: unknown): value is RegistryMessage =>
	Array.isArray(value) &&
	value[0] === protocol &&
	Number.isSafeInteger(value[2]) &&
	(value[2] as number) >= 0 &&
	((value[1] === "register" && value.length === 4 && typeof value[3] === "string") ||
		(value[1] === "registered" &&
			value.length === 4 &&
			Number.isSafeInteger(value[3]) &&
			(value[3] as number) > 0 &&
			(value[3] as number) <= 0xffff_ffff));
