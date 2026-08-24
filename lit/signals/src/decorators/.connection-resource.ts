/// <reference lib="esnext.disposable" preserve="true" />

import type { ReactiveController, ReactiveControllerHost } from "lit";

/** A synchronously or asynchronously disposable host-owned resource. */
export type ConnectionResource = Disposable | AsyncDisposable;

/** Configures how long a resource survives host disconnection. */
export interface ConnectedResourceOptions {
	/** Milliseconds, or a delay supplier, before disposing a disconnected resource. */
	readonly disconnectDelay?: number | (() => number);
}

/** Owns one disposable resource while a reactive host remains connected. */
export class ConnectionResourceController<Host extends ReactiveControllerHost> implements ReactiveController {
	#resource: ConnectionResource | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;

	/** Registers a host-owned resource factory and its disconnection policy. */
	constructor(host: Host, create: (host: Host) => ConnectionResource, options: ConnectedResourceOptions) {
		this.#create = create;
		this.#host = host;
		this.#options = options;
		host.addController(this);
	}

	readonly #create: (host: Host) => ConnectionResource;
	readonly #host: Host;
	readonly #options: ConnectedResourceOptions;

	/** Restores or creates the resource when its host connects. */
	hostConnected(): void {
		if (this.#timer !== undefined) {
			clearTimeout(this.#timer);
			this.#timer = undefined;
		}

		this.#resource ??= this.#create(this.#host);
	}

	/** Disposes the resource immediately or after the configured disconnection delay. */
	hostDisconnected(): void {
		if (this.#resource === undefined || this.#timer !== undefined) {
			return;
		}

		const { disconnectDelay } = this.#options;

		if (disconnectDelay === undefined) {
			this.#dispose();

			return;
		}

		const delay = typeof disconnectDelay === "function" ? disconnectDelay() : disconnectDelay;

		this.#timer = setTimeout(() => this.#dispose(), delay);
	}

	#dispose(): void {
		this.#timer = undefined;

		const resource = this.#resource;

		this.#resource = undefined;

		if (resource === undefined) {
			return;
		}

		try {
			const disposed =
				Symbol.asyncDispose in resource ? resource[Symbol.asyncDispose]() : resource[Symbol.dispose]();

			void Promise.resolve(disposed).catch((error: unknown) => reportError(error));
		} catch (error) {
			reportError(error);
		}
	}
}
