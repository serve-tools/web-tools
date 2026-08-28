import { createBindingScope } from "@serve-tools/signal-dom";

/** A custom element whose layout survives disconnection without retaining active subscriptions. */
export class AUIElement extends HTMLElement {
	#bindings = createBindingScope();
	#connection: Connection | undefined;
	#initialized = false;
	#failed = false;
	#reconciling = false;
	#retrying = false;
	#retryQueued = false;

	/** Chooses the layout's destination without replacing author-provided content. */
	protected createLayoutRoot(): HTMLElement | ShadowRoot {
		return this;
	}

	/** Builds owned content once into a detached fragment after subclass initialization. */
	protected layout(_content: DocumentFragment): void {}

	/** Acquires resources for one connected interval; register cleanup as each resource is acquired. */
	protected connect(_connection: AUIElement.Connection): void | (() => void) {}

	/** Refreshes relationships that depend on the element's ancestors after a connected move. */
	protected moved(_connection: AUIElement.Connection): void {}

	/** Activates bindings and connection resources after insertion. */
	connectedCallback(): void {
		this.#reconcile();
	}

	/** Stops observation synchronously when the element is actually disconnected. */
	disconnectedCallback(): void {
		if (this.isConnected) {
			this.#move();
			return;
		}

		this.#disconnect();
	}

	/** Preserves state during a platform-supported connected move. */
	connectedMoveCallback(): void {
		this.#move();
	}

	/** Reacquires resources from the new document without reconstructing layout. */
	adoptedCallback(): void {
		this.#disconnect();
		this.#reconcile();
	}

	#move(): void {
		if (!this.#connection) {
			return;
		}

		try {
			this.moved(this.#connection);
		} catch (error) {
			const errors = [error];

			try {
				this.#disconnect();
			} catch (cleanupError) {
				errors.push(cleanupError);
			}

			throwErrors(errors, "AUI move failed");
		}
	}

	#initialize(): void {
		const content = this.ownerDocument.createDocumentFragment();
		let nodes: ChildNode[] = [];
		let root: HTMLElement | ShadowRoot | undefined;

		try {
			root = this.createLayoutRoot();
			this.#bindings.capture(() => this.layout(content));
			nodes = [...content.childNodes];
			this.#initialized = true;
			root.append(content);
		} catch (error) {
			this.#failed = true;
			const errors = [error];

			try {
				this.#bindings.dispose();
			} catch (cleanupError) {
				errors.push(cleanupError);
			}

			for (const node of nodes) {
				if (node.parentNode === root) {
					node.remove();
				}
			}

			throwErrors(errors, "AUI layout initialization failed");
		}
	}

	#reconcile(): void {
		if (!this.isConnected || this.#failed) {
			return;
		}
		if (this.#reconciling) {
			this.#defer();
			return;
		}
		if (this.#connection) {
			return;
		}

		this.#reconciling = true;

		try {
			if (!this.#initialized) {
				this.#initialize();
			}
			if (!this.isConnected) {
				return;
			}

			const connection = new Connection(this.ownerDocument);
			this.#connection = connection;

			if (!this.#bindings.resume() || this.#connection !== connection || !this.isConnected) {
				this.#disconnect();
				this.#interrupted();
				return;
			}

			const cleanup = this.connect(connection);
			if (cleanup !== undefined) {
				if (typeof cleanup !== "function") {
					throw new TypeError("AUI connect() must finish synchronously");
				}
				connection.addCleanup(cleanup);
			}

			if (this.#connection !== connection || !this.isConnected) {
				this.#interrupted();
			}
		} catch (error) {
			const errors = [error];

			try {
				this.#disconnect();
			} catch (cleanupError) {
				errors.push(cleanupError);
			}

			throwErrors(errors, "AUI connection failed");
		} finally {
			this.#reconciling = false;
		}
	}

	#interrupted(): void {
		if (!this.isConnected) {
			return;
		}
		if (this.#retrying) {
			throw new Error("AUI connectivity repeatedly changed during activation");
		}
		this.#defer();
	}

	#defer(): void {
		if (this.#retryQueued || this.#retrying) {
			return;
		}
		this.#retryQueued = true;

		queueMicrotask(() => {
			this.#retryQueued = false;
			this.#retrying = true;

			try {
				this.#reconcile();
			} finally {
				this.#retrying = false;
			}
		});
	}

	#disconnect(): void {
		const connection = this.#connection;
		this.#connection = undefined;
		const wasReconciling = this.#reconciling;
		this.#reconciling = true;
		const errors: unknown[] = [];

		try {
			this.#bindings.suspend();
		} catch (error) {
			errors.push(error);
		}

		try {
			connection?.close();
		} catch (error) {
			errors.push(error);
		}

		this.#reconciling = wasReconciling;
		throwErrors(errors, "AUI disconnection failed");
	}
}

/** Types used by AUI custom-element lifecycles. */
export namespace AUIElement {
	/** Owns external resources for one connected interval. */
	export interface Connection {
		/** Aborted synchronously on disconnection or failed setup. */
		readonly signal: AbortSignal;

		/** Registers cleanup immediately, or invokes it now if this interval has already ended. */
		addCleanup(cleanup: () => void): void;
	}
}

class Connection implements AUIElement.Connection {
	#controller: AbortController;
	#cleanups: (() => void)[] | undefined;

	constructor(document: Document) {
		const Controller = document.defaultView?.AbortController ?? AbortController;
		this.#controller = new Controller();
	}

	get signal(): AbortSignal {
		return this.#controller.signal;
	}

	addCleanup(cleanup: () => void): void {
		if (this.signal.aborted) {
			cleanup();
		} else {
			(this.#cleanups ??= []).push(cleanup);
		}
	}

	close(): void {
		if (this.signal.aborted) {
			return;
		}
		const cleanups = this.#cleanups;
		this.#cleanups = undefined;
		const errors: unknown[] = [];

		try {
			this.#controller.abort();
		} catch (error) {
			errors.push(error);
		}

		if (cleanups) {
			for (let index = cleanups.length - 1; index >= 0; --index) {
				try {
					cleanups[index]();
				} catch (error) {
					errors.push(error);
				}
			}
		}

		throwErrors(errors, "AUI connection cleanup failed");
	}
}

const throwErrors = (errors: unknown[], message: string): void => {
	if (errors.length === 1) {
		throw errors[0];
	}
	if (errors.length > 1) {
		throw new AggregateError(errors, message);
	}
};
