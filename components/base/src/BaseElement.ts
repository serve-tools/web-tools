/// <reference lib="esnext.disposable" preserve="true" />

import { createBindingScope } from "@serve-tools/signal-dom";
import type { TemplateResult } from "@serve-tools/signal-dom/template";
import { createFragment, isTemplateResult } from "@serve-tools/signal-dom/template";

/** A custom element whose layout survives disconnection without retaining active subscriptions. */
export class BaseElement extends HTMLElement {
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
	// biome-ignore lint/correctness/noUnusedFunctionParameters: Overrides may ignore the connection.
	protected layout(content: DocumentFragment): void | TemplateResult {}

	/** Acquires resources for one connected interval; register cleanup as each resource is acquired. */
	// biome-ignore lint/correctness/noUnusedFunctionParameters: Overrides may ignore the connection.
	protected connect(connection: BaseElement.Connection): void | (() => void) {}

	/** Refreshes relationships that depend on the element's ancestors after a connected move. */
	// biome-ignore lint/correctness/noUnusedFunctionParameters: Overrides may ignore the connection.
	protected moved(connection: BaseElement.Connection): void {}

	// #region Lifecycle

	/** Activates bindings and connection resources after insertion. */
	connectedCallback(): void {
		this.#connect();
	}

	/** Stops observation synchronously when the element is actually disconnected. */
	disconnectedCallback(): void {
		if (this.isConnected) {
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
		this.#connect();
	}

	// #endregion Lifecycle

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

			throwErrors(errors, "Base move failed");
		}
	}

	#initialize(): void {
		const content = this.ownerDocument.createDocumentFragment();

		let nodes: ChildNode[] = [];
		let root: HTMLElement | ShadowRoot | undefined;

		try {
			root = this.createLayoutRoot();

			this.#bindings.capture(() => {
				const result = this.layout(content);

				if (isTemplateResult(result)) {
					content.append(createFragment(result, this, this.ownerDocument));
				} else if (result !== undefined) {
					throw new TypeError("Base layout() must return a TemplateResult or finish synchronously");
				}
			});

			nodes = [...content.childNodes];

			this.#initialized = true;

			root.append(content);
		} catch (error) {
			this.#failed = true;
			const errors = [error as Error];

			try {
				this.#bindings.dispose();
			} catch (cleanupError) {
				errors.push(cleanupError as Error);
			}

			for (const node of nodes) {
				if (node.parentNode === root) {
					node.remove();
				}
			}

			throwErrors(errors, "Base layout initialization failed");
		}
	}

	#connect(): void {
		if (!this.isConnected || this.#failed) {
			return;
		}

		if (this.#reconciling) {
			this.#defer();

			return;
		}

		if (this.#connection) {
			this.#move();

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
					throw new TypeError("Base connect() must finish synchronously");
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

			throwErrors(errors, "Base connection failed");
		} finally {
			this.#reconciling = false;
		}
	}

	#interrupted(): void {
		if (!this.isConnected) {
			return;
		}

		if (this.#retrying) {
			throw new Error("Base connectivity repeatedly changed during activation");
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
				this.#connect();
			} finally {
				this.#retrying = false;
			}
		});
	}

	#disconnect(): void {
		const connection = this.#connection;

		this.#connection = undefined;

		const reconciling = this.#reconciling;

		this.#reconciling = true;

		const errors: Error[] = [];

		try {
			this.#bindings.suspend();
		} catch (error) {
			errors.push(error as Error);
		}

		try {
			connection?.close();
		} catch (error) {
			errors.push(error as Error);
		}

		this.#reconciling = reconciling;

		throwErrors(errors, "Base disconnection failed");
	}
}

/** Types used by Base custom-element lifecycles. */
export namespace BaseElement {
	/** Owns external resources for one connected interval. */
	export interface Connection {
		/** Aborted synchronously on disconnection or failed setup. */
		readonly signal: AbortSignal;

		/** Registers cleanup immediately, or invokes it now if this interval has already ended. */
		addCleanup(cleanup: () => void): void;
	}
}

class Connection implements BaseElement.Connection {
	#closed = false;
	#controller: AbortController | undefined;
	#cleanups: DisposableStack | undefined;

	constructor(private readonly document: Document) {}

	get signal(): AbortSignal {
		const Controller = this.document.defaultView?.AbortController ?? AbortController;
		const controller = (this.#controller ??= new Controller());

		if (this.#closed) {
			controller.abort();
		}

		return controller.signal;
	}

	addCleanup(cleanup: () => void): void {
		if (this.#closed) {
			cleanup();
		} else {
			(this.#cleanups ??= new DisposableStack()).defer(cleanup);
		}
	}

	close(): void {
		if (this.#closed) {
			return;
		}

		this.#closed = true;

		const errors: unknown[] = [];

		try {
			this.#controller?.abort();
		} catch (error) {
			errors.push(error);
		}

		try {
			this.#cleanups?.dispose();
		} catch (error) {
			errors.push(error);
		}

		throwErrors(errors, "Base connection cleanup failed");
	}
}

function throwErrors(errors: unknown[], message: string): asserts errors is [] {
	if (errors.length === 1) {
		throw errors[0];
	}

	if (errors.length > 1) {
		throw new AggregateError(errors, message);
	}
}
