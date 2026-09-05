import { defineStringTag } from "./_internals.js";

export class DisposableElement extends HTMLElement {
	static readonly disposables: readonly DisposableElement.DisposableInitiator[] = [];

	// #region Properties

	dispose(): void {
		this.#dispose();
	}

	disconnectedSignal(): AbortSignal {
		return this.#signal();
	}

	[Symbol.dispose](): void {
		this.#dispose();
	}

	// #endregion Properties

	// #region Lifecycle Callbacks

	connectedCallback(): void {
		this.#connect();
	}

	disconnectedCallback(): void {
		if (!this.isConnected) {
			this.#dispose();
		}
	}

	adoptedCallback(): void {
		this.#dispose();
		this.#connect();
	}

	connectedMoveCallback(): void {
		// preserve resources during a same-document connected move
	}

	// #endregion Lifecycle Callbacks

	// #region Internals

	#connections: DisposableStack | undefined;
	#connecting = false;
	#connectQueued = false;
	#controllers: AbortController[] = [];
	#disposing = false;
	#retrying = false;

	#connect() {
		if (!this.isConnected || this.#connections) {
			return;
		}

		if (this.#connecting || this.#disposing) {
			this.#connectQueued = true;

			return;
		}

		const { disposables } = this.constructor;

		if (!disposables.length) {
			return;
		}

		this.#connecting = true;

		const connections = (this.#connections = new DisposableStack());

		try {
			for (const disposable of disposables) {
				if (connections.disposed) {
					break;
				}

				try {
					const cleanup = disposable(this);

					if (typeof cleanup === "function") {
						connections.disposed ? cleanup() : connections.defer(cleanup);
					}
				} catch (error) {
					reportError(error);
				}
			}
		} finally {
			this.#connecting = false;
			this.#reconnect();
		}
	}

	#dispose() {
		if (this.#disposing) {
			return;
		}

		const connections = this.#connections;
		const controllers = this.#controllers;

		this.#connections = undefined;
		this.#controllers = [];
		this.#disposing = true;

		try {
			for (const controller of controllers) {
				controller.abort();
			}

			connections?.dispose();
		} finally {
			this.#disposing = false;
			this.#reconnect();
		}
	}

	#signal(): AbortSignal {
		const controller = new AbortController();

		this.#controllers.push(controller);

		return controller.signal;
	}

	#reconnect(): void {
		if (!this.#connectQueued || this.#connecting || this.#disposing) {
			return;
		}

		this.#connectQueued = false;

		if (this.#retrying) {
			reportError(new Error("DisposableElement connectivity repeatedly changed during activation"));

			return;
		}

		this.#retrying = true;

		try {
			this.#connect();
		} finally {
			this.#retrying = false;
		}
	}

	// #endregion Internals

	declare readonly ["constructor"]: typeof DisposableElement;

	static {
		defineStringTag(this, "DisposableElement");
	}
}

export namespace DisposableElement {
	export interface DisposableInitiator {
		(host: DisposableElement): DisposableResult;
	}

	export type DisposableResult = void | DisposableDisposer;

	export type DisposableDisposer = () => void;
}
