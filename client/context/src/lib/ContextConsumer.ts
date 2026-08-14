import { reportContextError } from "./.internals.js";
import { type ContextRoot, getContextRoot } from "./ContextRoot.js";
import { type Context, type ContextCallback, ContextRequestEvent, type ContextType } from "./context.js";

/** Options for a context consumer. */
export interface ContextConsumerOptions<RequestedContext extends Context<unknown, unknown>> {
	/** Receives the initial value and subscribed updates. */
	callback: ContextCallback<ContextType<RequestedContext>>;

	/** The requested context key. */
	context: RequestedContext;

	/** Whether to retain misses and receive later values. @default false */
	subscribe?: boolean;
}

/** Owns request, replacement, cancellation, reconnection, and explicit move lifecycle for one context. */
export class ContextConsumer<RequestedContext extends Context<unknown, unknown>> {
	readonly #host: Element;
	readonly #context: RequestedContext;
	readonly #receiveValue: ContextCallback<ContextType<RequestedContext>>;
	readonly #subscribe: boolean;
	#connected = false;
	#root: ContextRoot | undefined;
	#unsubscribe: (() => void) | undefined;

	constructor(host: Element, { callback, context, subscribe = false }: ContextConsumerOptions<RequestedContext>) {
		this.#host = host;
		this.#context = context;
		this.#receiveValue = callback;
		this.#subscribe = subscribe;
	}

	/** Dispatches a fresh request and retains a subscribing miss at the document root. */
	connect(): void {
		if (this.#connected) {
			return;
		}

		this.#connected = true;

		if (this.#subscribe) {
			this.#root = getContextRoot(this.#host.ownerDocument);
		}

		this.#request();
	}

	/** Cancels any retained miss or active subscription. */
	disconnect(): void {
		if (!this.#connected) {
			return;
		}

		this.#connected = false;
		this.#root?.cancel(this.#context, this.#host, this.#callback as ContextCallback<unknown>);
		this.#root = undefined;
		this.#release();
	}

	/** Re-evaluates the nearest provider after a state-preserving DOM move or other topology change. */
	refresh(): void {
		if (!this.#connected) {
			return;
		}

		this.#root?.cancel(this.#context, this.#host, this.#callback as ContextCallback<unknown>);
		this.#release();
		this.#request();
	}

	readonly #callback: ContextCallback<ContextType<RequestedContext>> = (value, unsubscribe): void => {
		if (!this.#connected) {
			unsubscribe?.();
			return;
		}

		this.#root?.cancel(this.#context, this.#host, this.#callback as ContextCallback<unknown>);

		if (!this.#subscribe) {
			if (unsubscribe !== undefined) {
				try {
					unsubscribe();
				} catch (error) {
					reportContextError(error);
				}
			}

			this.#receiveValue.call(this.#host, value);
			return;
		}

		if (unsubscribe === this.#unsubscribe) {
			this.#receiveValue.call(this.#host, value, unsubscribe);
			return;
		}

		const previous = this.#unsubscribe;

		this.#unsubscribe = unsubscribe;

		try {
			previous?.();
		} catch (error) {
			reportContextError(error);
		}

		try {
			this.#receiveValue.call(this.#host, value, unsubscribe);
		} catch (error) {
			if (this.#unsubscribe === unsubscribe) {
				this.#unsubscribe = undefined;
			}

			unsubscribe?.();
			throw error;
		}
	};

	#release(): void {
		const unsubscribe = this.#unsubscribe;

		this.#unsubscribe = undefined;

		try {
			unsubscribe?.();
		} catch (error) {
			reportContextError(error);
		}
	}

	#request(): void {
		this.#host.dispatchEvent(new ContextRequestEvent(this.#context, this.#host, this.#callback, this.#subscribe));
	}
}
