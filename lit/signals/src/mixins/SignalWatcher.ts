import { Signal } from "@serve-tools/signal";
import type { LitElement } from "lit";

/** Makes a Lit element's render method reactive to the signals it reads. */
export const SignalWatcher = <Base extends LitElementConstructor>(BaseElement: Base): Base => {
	class SignalWatcherElement extends BaseElement {
		#isConnected = false;
		#isInvalidatingRender = false;
		readonly #originalRender: () => unknown;
		readonly #renderComputed: Signal.Computed<unknown>;
		readonly #renderVersionSignal = new Signal.State(false);

		readonly #watcher = new Signal.subtle.Watcher(() => {
			if (this.#isConnected && !this.#isInvalidatingRender) {
				this.requestUpdate();
			}
		});

		static #readRender(this: SignalWatcherElement): unknown {
			return this.#renderComputed.get();
		}

		constructor(...args: any[]) {
			super(...args);

			this.#originalRender = this.render;
			this.#renderComputed = new Signal.Computed(() => {
				this.#renderVersionSignal.get();

				return this.#originalRender.call(this);
			});

			Object.defineProperty(this, "render", {
				configurable: true,
				value: SignalWatcherElement.#readRender,
			});
		}

		protected override performUpdate(): void {
			this.#isInvalidatingRender = true;

			try {
				this.#renderVersionSignal.set(!this.#renderVersionSignal.get());
			} finally {
				this.#isInvalidatingRender = false;

				if (this.#isConnected) {
					this.#watcher.watch(this.#renderComputed);
				} else {
					this.#watcher.watch();
				}
			}

			super.performUpdate();
		}

		connectedCallback(): void {
			super.connectedCallback();

			this.#isConnected = true;
			this.#watcher.watch(this.#renderComputed);
			this.requestUpdate();
		}

		disconnectedCallback(): void {
			this.#isConnected = false;
			this.#watcher.unwatch(this.#renderComputed);

			super.disconnectedCallback();
		}
	}

	return SignalWatcherElement as Base;
};

// #region Types

type LitElementConstructor = new (...args: any[]) => LitElement;

// #endregion Types
