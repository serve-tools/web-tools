import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";

type RegisterMessage = readonly [protocol: string, type: "register", request: number, name: string];
type RegisteredMessage = readonly [protocol: string, type: "registered", request: number, kind: number];
type RegistryMessage = RegisterMessage | RegisteredMessage;

export class DatagramRegistry {
	readonly #send: (payload: Uint8Array) => void;
	readonly #decoder = new FrameDecoder();
	readonly #incomingNames = new Map<number, string>();
	readonly #incomingKinds = new Map<string, number>();
	readonly #outgoing = new Map<string, Promise<number>>();
	readonly #pending = new Map<number, ReturnType<typeof Promise.withResolvers<number>>>();
	#nextKind = 0;
	#nextRequest = 0;

	constructor(send: (payload: Uint8Array) => void) {
		this.#send = send;
	}

	name(kind: number): string | undefined {
		return this.#incomingNames.get(kind);
	}

	register(name: string): Promise<number> {
		let registration = this.#outgoing.get(name);

		if (registration) {
			return registration;
		}

		if (this.#nextRequest >= Number.MAX_SAFE_INTEGER) {
			return Promise.reject(new RangeError("The datagram registry exhausted its request IDs"));
		}

		const request = ++this.#nextRequest;
		const pending = Promise.withResolvers<number>();

		this.#pending.set(request, pending);

		registration = pending.promise;

		this.#outgoing.set(name, registration);
		this.#send(encodeFrame(serialize([protocol, "register", request, name] satisfies RegisterMessage)));

		return registration;
	}

	receive(chunk: ArrayBuffer | ArrayBufferView): void {
		for (const frame of this.#decoder.push(chunk)) {
			const message = deserialize(frame);

			if (!isRegistryMessage(message)) {
				throw new TypeError("Invalid datagram registry message");
			}

			if (message[1] === "register") {
				let kind = this.#incomingKinds.get(message[3]);

				if (kind === undefined) {
					if (this.#nextKind >= 0xffff_ffff) {
						throw new RangeError("The datagram registry exhausted its kind IDs");
					}

					kind = ++this.#nextKind;

					this.#incomingKinds.set(message[3], kind);
					this.#incomingNames.set(kind, message[3]);
				}

				this.#send(
					encodeFrame(serialize([protocol, "registered", message[2], kind] satisfies RegisteredMessage)),
				);
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

	finish(): void {
		this.#decoder.finish();
	}

	fail(reason: unknown): void {
		for (const pending of this.#pending.values()) {
			pending.reject(reason);
		}

		this.#pending.clear();
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
