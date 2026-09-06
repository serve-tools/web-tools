import type { Context, ContextType } from "@serve-tools/client-context";
import { ContextConsumer, ContextProvider } from "@serve-tools/client-context";
import { Signal } from "@serve-tools/signal";
import type { ReactiveController } from "lit";
import type { ReactiveElement } from "./_internals.js";

/** A reactive custom element that can own context lifecycle controllers. */
export type ContextElement = HTMLElement &
	ReactiveElement & {
		/** Registers a reactive lifecycle controller with the host element. */
		addController(controller: ReactiveController): void;
	};

/** Chooses signal-only invalidation or the complete Lit update lifecycle. */
export type ContextUpdate = "atomic" | "lifecycle";

const enum ContextRefreshKind {
	Consumer = 0,
	Provider = 1,
}

interface RefreshableContextController extends ReactiveController {
	readonly refreshKind: ContextRefreshKind;
	refresh(): void;
}

const contextControllers = new WeakMap<ContextElement, Set<RefreshableContextController>>();

const registerContextController = (host: ContextElement, controller: RefreshableContextController): void => {
	let controllers = contextControllers.get(host);

	if (controllers === undefined) {
		controllers = new Set();
		contextControllers.set(host, controllers);
	}

	controllers.add(controller);
	host.addController(controller);
};

/** Re-evaluates decorated consumers and providers after a state-preserving DOM move. */
export const refreshContexts = (host: ContextElement): void => {
	const controllers = contextControllers.get(host);

	if (controllers === undefined) {
		return;
	}

	for (const controller of controllers) {
		if (controller.refreshKind === ContextRefreshKind.Provider) {
			controller.refresh();
		}
	}

	for (const controller of controllers) {
		if (controller.refreshKind === ContextRefreshKind.Consumer) {
			controller.refresh();
		}
	}
};

/** Creates context-backed signal state and requests an initial lifecycle update when needed. */
export const initializeContextState = <This extends ReactiveElement, Value>(
	host: This,
	name: PropertyKey,
	value: Value,
	update: ContextUpdate,
): Signal.State<Value> => {
	const state = new Signal.State(value);

	if (value !== undefined && update === "lifecycle") {
		host.requestUpdate(name, undefined, { attribute: false }, true, value);
	}

	return state;
};

/** Updates context-backed signal state using its configured Lit update strategy. */
export const setContextState = <This extends ReactiveElement, Value>(
	host: This,
	name: PropertyKey,
	state: Signal.State<Value>,
	value: Value,
	update: ContextUpdate,
): void => {
	if (update === "lifecycle") {
		const oldValue = Signal.subtle.untrack(() => state.get());

		state.set(value);

		host.requestUpdate(name, oldValue, { attribute: false }, true, value);
	} else {
		state.set(value);
	}
};

/** Owns a signal-backed context consumer for a reactive host element. */
export class AtomicContextConsumer<C extends Context<unknown, unknown>> implements ReactiveController {
	/** Identifies this controller as a context consumer during host refresh. */
	readonly refreshKind = ContextRefreshKind.Consumer;

	readonly #consumer: ContextConsumer<C>;

	/** Registers a consumer that forwards matching context values to its host. */
	constructor(host: ContextElement, context: C, subscribe: boolean, setValue: (value: ContextType<C>) => void) {
		this.#consumer = new ContextConsumer(host, {
			context,
			subscribe,
			callback: setValue,
		});

		registerContextController(host, this);
	}

	/** Connects the consumer when its host enters the document. */
	hostConnected(): void {
		this.#consumer.connect();
	}

	/** Disconnects the consumer when its host leaves the document. */
	hostDisconnected(): void {
		this.#consumer.disconnect();
	}

	/** Re-evaluates the active provider after a context-preserving host move. */
	refresh(): void {
		this.#consumer.refresh();
	}
}

/** Owns a signal-backed context provider for a reactive host element. */
export class AtomicContextProvider<C extends Context<unknown, unknown>> implements ReactiveController {
	/** Identifies this controller as a context provider during host refresh. */
	readonly refreshKind = ContextRefreshKind.Provider;

	readonly #provider: ContextProvider<C>;

	/** Registers a provider exposing its initial context value from the host. */
	constructor(host: ContextElement, context: C, initialValue: ContextType<C>) {
		this.#provider = new ContextProvider(host, { context, initialValue });

		registerContextController(host, this);
	}

	/** Connects the provider when its host enters the document. */
	hostConnected(): void {
		this.#provider.connect();
	}

	/** Disconnects the provider when its host leaves the document. */
	hostDisconnected(): void {
		this.#provider.disconnect();
	}

	/** Announces this provider again after a context-preserving host move. */
	refresh(): void {
		this.#provider.announce();
	}

	/** Publishes a new context value to the provider's active consumers. */
	setValue(value: ContextType<C>): void {
		this.#provider.setValue(value);
	}
}
