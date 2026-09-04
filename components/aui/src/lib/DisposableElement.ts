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
	#controllers: AbortController[] = [];

	#connect() {
		if (!this.isConnected || this.#connections) {
			return;
		}

		const { disposables } = this.constructor;

		if (!disposables.length) {
			return;
		}

		const connections = (this.#connections = new DisposableStack());

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
	}

	#dispose() {
		const connections = this.#connections;
		const controllers = this.#controllers;

		this.#connections = undefined;
		this.#controllers = [];

		for (const controller of controllers) {
			controller.abort();
		}

		connections?.dispose();
	}

	#signal(): AbortSignal {
		const controller = new AbortController();

		this.#controllers.push(controller);

		return controller.signal;
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
