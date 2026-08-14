import type { Context, ContextType } from "@serve-tools/client-context";
import { ContextConsumer, ContextProvider } from "@serve-tools/client-context";
import { Signal } from "@serve-tools/signal";
import type { ReactiveController } from "lit";
import type { ReactiveElement } from "./.internals.js";

export type ContextElement = HTMLElement &
	ReactiveElement & {
		addController(controller: ReactiveController): void;
	};

export type ContextUpdate = "atomic" | "lifecycle";

interface RefreshableContextController extends ReactiveController {
	readonly refreshKind: "consumer" | "provider";
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
		if (controller.refreshKind === "provider") {
			controller.refresh();
		}
	}

	for (const controller of controllers) {
		if (controller.refreshKind === "consumer") {
			controller.refresh();
		}
	}
};

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

export class AtomicContextConsumer<C extends Context<unknown, unknown>> implements ReactiveController {
	readonly refreshKind = "consumer";
	readonly #consumer: ContextConsumer<C>;

	constructor(host: ContextElement, context: C, subscribe: boolean, setValue: (value: ContextType<C>) => void) {
		this.#consumer = new ContextConsumer(host, {
			context,
			subscribe,
			callback: setValue,
		});

		registerContextController(host, this);
	}

	hostConnected(): void {
		this.#consumer.connect();
	}

	hostDisconnected(): void {
		this.#consumer.disconnect();
	}

	refresh(): void {
		this.#consumer.refresh();
	}
}

export class AtomicContextProvider<C extends Context<unknown, unknown>> implements ReactiveController {
	readonly refreshKind = "provider";
	readonly #provider: ContextProvider<C>;

	constructor(host: ContextElement, context: C, initialValue: ContextType<C>) {
		this.#provider = new ContextProvider(host, { context, initialValue });

		registerContextController(host, this);
	}

	hostConnected(): void {
		this.#provider.connect();
	}

	hostDisconnected(): void {
		this.#provider.disconnect();
	}

	refresh(): void {
		this.#provider.announce();
	}

	setValue(value: ContextType<C>): void {
		this.#provider.setValue(value);
	}
}
