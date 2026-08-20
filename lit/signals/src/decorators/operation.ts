/// <reference lib="esnext.disposable" preserve="true" />

import type { OperationView } from "@serve-tools/async-operation";
import { Signal } from "@serve-tools/signal";
import type { ReactiveControllerHost } from "lit";

import { ConnectionResourceController } from "./.connection-resource.js";

/** Configures the connection lifetime of an operation-view accessor. */
export interface OperationOptions {
	/** Delays unsubscription after disconnection, allowing brief moves to retain the subscription. */
	readonly disconnectDelay?: number | (() => number);
}

/** Connects one operation view to a read-only signal-backed accessor. */
export const operation =
	<Value>(view: OperationView<Value>, options: OperationOptions = {}) =>
	<This extends ReactiveControllerHost>(
		target: ClassAccessorDecoratorTarget<This, Value>,
		{ addInitializer, name, static: isStatic }: ClassAccessorDecoratorContext<This, Value>,
	): ClassAccessorDecoratorResult<This, Value> => {
		if (isStatic) {
			throw new TypeError("@operation cannot decorate a static accessor");
		}

		const stateOf = (host: This) => target.get.call(host) as unknown as Signal.State<Value>;

		addInitializer(function (): void {
			const state = stateOf(this);

			new ConnectionResourceController(this, () => view.subscribe((value) => state.set(value)), options);
		});

		return {
			init(initialValue) {
				return new Signal.State(initialValue) as unknown as Value;
			},
			get() {
				return stateOf(this).get();
			},
			set() {
				throw new TypeError(`Cannot assign to operation-backed property ${String(name)}.`);
			},
		};
	};
