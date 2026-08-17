import { getContextConsumer, getContextProvider, isInvalidContext } from "./.internals.js";
import type { Context, ContextCallback, ContextType } from "./context.js";
import { ContextProviderEvent, ContextRequestEvent } from "./context.js";

interface Subscription<ValueType> {
	readonly callback: ContextCallback<ValueType>;
	readonly consumer: Element;
	readonly unsubscribe: () => void;

	active: boolean;
}

const activeProviders = new WeakMap<Element, Map<unknown, ContextProvider<Context<unknown, unknown>>>>();

/** Options for a context provider. */
export interface ContextProviderOptions<ProvidedContext extends Context<unknown, unknown>> {
	/** The context key supplied by this provider. */
	context: ProvidedContext;

	/** The value delivered until `setValue()` replaces it. */
	initialValue: ContextType<ProvidedContext>;
}

/** Provides one context through the structural Context Protocol. */
export class ContextProvider<ProvidedContext extends Context<unknown, unknown>> {
	readonly #host: Element;
	readonly #context: ProvidedContext;
	readonly #subscriptions = new Map<
		Element,
		Map<ContextCallback<ContextType<ProvidedContext>>, Subscription<ContextType<ProvidedContext>>>
	>();
	#active = false;
	#value: ContextType<ProvidedContext>;

	constructor(host: Element, { context, initialValue }: ContextProviderOptions<ProvidedContext>) {
		if (isInvalidContext(context)) {
			throw new TypeError("A context key cannot be NaN.");
		}

		this.#host = host;
		this.#context = context;
		this.#value = initialValue;
	}

	/** Installs request handling and announces this provider. */
	connect(): void {
		if (this.#active) {
			return;
		}

		let providers = activeProviders.get(this.#host);

		if (providers === undefined) {
			providers = new Map();
			activeProviders.set(this.#host, providers);
		}

		if (providers.has(this.#context)) {
			throw new Error("Only one active provider may provide a context from the same element.");
		}

		providers.set(this.#context, this as ContextProvider<Context<unknown, unknown>>);
		this.#active = true;
		this.#host.addEventListener("context-request", this.#onContextRequest);
		this.#host.addEventListener("context-provider", this.#onContextProvider);
		this.announce();
	}

	/** Removes request handling and gives live subscriptions a chance to fall back to another provider. */
	disconnect(): void {
		if (!this.#active) {
			return;
		}

		this.#active = false;
		this.#host.removeEventListener("context-request", this.#onContextRequest);
		this.#host.removeEventListener("context-provider", this.#onContextProvider);

		const providers = activeProviders.get(this.#host);

		providers?.delete(this.#context);

		if (providers?.size === 0) {
			activeProviders.delete(this.#host);
		}

		for (const subscription of this.#subscriptionSnapshot()) {
			subscription.unsubscribe();
			subscription.consumer.dispatchEvent(
				new ContextRequestEvent(this.#context, subscription.consumer, subscription.callback, true),
			);
		}
	}

	/** Replaces the current value and independently notifies every live subscriber. */
	setValue(value: ContextType<ProvidedContext>): void {
		this.#value = value;

		for (const subscription of this.#subscriptionSnapshot()) {
			if (!subscription.active) {
				continue;
			}

			try {
				subscription.callback.call(subscription.consumer, value, subscription.unsubscribe);
			} catch (error) {
				reportError(error);
			}
		}
	}

	/** Announces that this provider may change context resolution for existing subscriptions. */
	announce(): void {
		if (this.#active) {
			this.#host.dispatchEvent(new ContextProviderEvent(this.#context, this.#host));
		}
	}

	readonly #onContextRequest: EventListener = (event): void => {
		const consumer = getContextConsumer(event);

		if (
			consumer === undefined ||
			(event as unknown as { context: unknown }).context !== this.#context ||
			consumer === this.#host
		) {
			return;
		}

		const request = event as unknown as {
			readonly callback: ContextCallback<ContextType<ProvidedContext>>;
			readonly subscribe?: boolean;
		};

		event.stopImmediatePropagation();

		if (!request.subscribe) {
			request.callback.call(consumer, this.#value);
			return;
		}

		let callbacks = this.#subscriptions.get(consumer);

		if (callbacks?.has(request.callback)) {
			return;
		}

		if (callbacks === undefined) {
			callbacks = new Map();
			this.#subscriptions.set(consumer, callbacks);
		}

		const subscription: Subscription<ContextType<ProvidedContext>> = {
			active: true,
			callback: request.callback,
			consumer,
			unsubscribe: () => {
				if (!subscription.active) {
					return;
				}

				subscription.active = false;
				callbacks.delete(request.callback);

				if (callbacks.size === 0) {
					this.#subscriptions.delete(consumer);
				}
			},
		};

		callbacks.set(request.callback, subscription);

		try {
			request.callback.call(consumer, this.#value, subscription.unsubscribe);
		} catch (error) {
			subscription.unsubscribe();
			reportError(error);
		}
	};

	readonly #onContextProvider: EventListener = (event): void => {
		const provider = getContextProvider(event);

		if (
			provider === undefined ||
			(event as unknown as { context: unknown }).context !== this.#context ||
			provider === this.#host ||
			this.#subscriptions.size === 0
		) {
			return;
		}

		event.stopImmediatePropagation();

		for (const subscription of this.#subscriptionSnapshot()) {
			subscription.consumer.dispatchEvent(
				new ContextRequestEvent(this.#context, subscription.consumer, subscription.callback, true),
			);
		}
	};

	#subscriptionSnapshot(): Array<Subscription<ContextType<ProvidedContext>>> {
		return [...this.#subscriptions.values()].flatMap((callbacks) => [...callbacks.values()]);
	}
}
