import { Signal } from "@serve-tools/signal";
import type { LitElement } from "lit";
import { enqueueMicrotask } from "../lib/scheduler.js";

/** Cleans up resources created by an update effect. */
export type EffectCleanup = () => void;

/** Runs reactive imperative work and optionally returns its cleanup. */
export type EffectCallback = (() => EffectCleanup) | (() => void);

/** Chooses when an effect runs relative to a pending Lit update. */
export type EffectPhase = "before-update" | "after-update";

/** Configures a host-owned update effect. */
export interface EffectOptions {
	/** Chooses when the effect runs relative to a pending Lit update. @default "after-update" */
	phase?: EffectPhase;

	/** Keeps the effect active while its host is disconnected. @default false */
	manualDispose?: boolean;
}

/** Public signal lifecycle API added by {@link SignalWatcher}. */
export interface SignalWatcherApi {
	/** Runs an effect for its signal dependencies and returns an idempotent disposer. */
	updateEffect(callback: EffectCallback, options?: EffectOptions): EffectCleanup;
}

/** Makes a Lit element's complete update lifecycle reactive to the signals it reads. */
export const SignalWatcher = <Base extends LitElementConstructor>(
	BaseElement: Base,
): Base & SignalWatcherConstructor => {
	class SignalWatcherElement extends BaseElement implements SignalWatcherApi {
		#disconnectVersion = 0;
		#effects = new Set<EffectRecord>();
		#effectForSignal = new Map<Signal.Computed<void>, EffectRecord>();
		#effectTaskPending = false;
		#isConnected = false;
		#isForcingUpdate = false;
		#updateSignal: Signal.Computed<void> | undefined;
		readonly #updateVersion = new Signal.State(0);

		readonly #effectTask = {
			run: (): void => {
				this.#effectTaskPending = false;

				if (this.#isConnected && this.isUpdatePending) {
					return;
				}

				this.#collectPendingEffects();
				this.#effectWatcher.watch();

				const errors = this.#flushEffects("before-update", !this.#isConnected);

				errors.push(...this.#flushEffects("after-update", !this.#isConnected));
				this.#throwErrors(errors);
			},
		};

		readonly #effectWatcher = new Signal.subtle.Watcher(() => this.#enqueueEffects());

		readonly #updateWatcher = new Signal.subtle.Watcher(() => {
			if (!this.#isForcingUpdate && this.#isConnected) {
				this.requestUpdate();
			}
		});

		updateEffect(callback: EffectCallback, options: EffectOptions = {}): EffectCleanup {
			const effect: EffectRecord = {
				active: false,
				callback,
				cleanup: undefined,
				computed: undefined,
				disposed: false,
				manualDispose: options.manualDispose ?? false,
				pending: true,
				phase: options.phase ?? "after-update",
			};

			this.#effects.add(effect);

			if (this.#isConnected) {
				this.#activateEffect(effect);
				this.#enqueueEffects();
			}

			return (): void => {
				if (effect.disposed) {
					return;
				}

				effect.disposed = true;
				this.#effects.delete(effect);
				this.#deactivateEffect(effect);
			};
		}

		protected override performUpdate(): void {
			if (!this.isUpdatePending) {
				return;
			}

			this.#ensureUpdateSignal();
			this.#collectPendingEffects();
			this.#effectWatcher.watch();
			this.#updateWatcher.watch();

			const errors = this.#flushEffects("before-update");

			this.#isForcingUpdate = true;

			try {
				Signal.subtle.untrack(() => this.#updateVersion.set(this.#updateVersion.get() + 1));
			} finally {
				this.#isForcingUpdate = false;
			}

			try {
				this.#updateSignal!.get();
			} catch (error) {
				errors.push(error);
			}

			errors.push(...this.#flushEffects("after-update"));
			this.#effectWatcher.watch();
			this.#updateWatcher.watch();

			this.#throwErrors(errors);
		}

		connectedCallback(): void {
			super.connectedCallback();

			this.#isConnected = true;
			++this.#disconnectVersion;
			this.#ensureUpdateSignal();

			for (const effect of this.#effects) {
				this.#activateEffect(effect);
			}

			this.requestUpdate();
		}

		disconnectedCallback(): void {
			this.#isConnected = false;

			const disconnectVersion = ++this.#disconnectVersion;

			if (this.#updateSignal !== undefined) {
				this.#updateWatcher.unwatch(this.#updateSignal);
				this.#updateSignal = undefined;
			}

			queueMicrotask(() => {
				if (this.#isConnected || disconnectVersion !== this.#disconnectVersion) {
					return;
				}

				const errors: unknown[] = [];

				for (const effect of this.#effects) {
					if (!effect.manualDispose) {
						try {
							this.#deactivateEffect(effect);
						} catch (error) {
							errors.push(error);
						}
					}
				}

				this.#throwErrors(errors);
			});

			super.disconnectedCallback();
		}

		#activateEffect(effect: EffectRecord): void {
			if (effect.active || effect.disposed) {
				return;
			}

			effect.pending = true;
			effect.computed = new Signal.Computed(() => {
				const cleanup = effect.cleanup;

				effect.cleanup = undefined;
				cleanup?.();

				const nextCleanup = effect.callback();

				if (nextCleanup !== undefined && typeof nextCleanup !== "function") {
					throw new TypeError("Expected an update effect cleanup function or undefined");
				}

				effect.cleanup = nextCleanup as EffectCleanup | undefined;
			});
			effect.active = true;

			this.#effectForSignal.set(effect.computed, effect);
			this.#effectWatcher.watch(effect.computed);
		}

		#deactivateEffect(effect: EffectRecord): void {
			if (!effect.active) {
				return;
			}

			const computed = effect.computed!;

			this.#effectWatcher.unwatch(computed);
			this.#effectForSignal.delete(computed);
			effect.active = false;
			effect.computed = undefined;
			effect.pending = true;

			const cleanup = effect.cleanup;

			effect.cleanup = undefined;
			cleanup?.();
		}

		#collectPendingEffects(): void {
			for (const signal of this.#effectWatcher.getPending()) {
				const effect = this.#effectForSignal.get(signal as Signal.Computed<void>);

				if (effect !== undefined) {
					effect.pending = true;
				}
			}
		}

		#enqueueEffects(): void {
			if (this.#effectTaskPending || (!this.#isConnected && !this.#hasActiveManualEffect())) {
				return;
			}

			this.#effectTaskPending = true;
			enqueueMicrotask(this.#effectTask);
		}

		#ensureUpdateSignal(): void {
			if (this.#updateSignal !== undefined) {
				return;
			}

			this.#updateSignal = new Signal.Computed(() => {
				this.#updateVersion.get();
				super.performUpdate();
			});

			this.#updateWatcher.watch(this.#updateSignal);
		}

		#flushEffects(phase: EffectPhase, manualOnly = false): unknown[] {
			const errors: unknown[] = [];

			for (const effect of this.#effects) {
				if (
					!effect.active ||
					!effect.pending ||
					effect.phase !== phase ||
					(manualOnly && !effect.manualDispose)
				) {
					continue;
				}

				effect.pending = false;

				try {
					effect.computed!.get();
				} catch (error) {
					errors.push(error);
				}
			}

			return errors;
		}

		#hasActiveManualEffect(): boolean {
			for (const effect of this.#effects) {
				if (effect.active && effect.manualDispose) {
					return true;
				}
			}

			return false;
		}

		#throwErrors(errors: unknown[]): void {
			if (errors.length === 1) {
				throw errors[0];
			}

			if (errors.length > 1) {
				throw new AggregateError(errors, "Multiple signal update effects failed");
			}
		}
	}

	return SignalWatcherElement as unknown as Base & SignalWatcherConstructor;
};

interface EffectRecord {
	active: boolean;
	callback: EffectCallback;
	cleanup: EffectCleanup | undefined;
	computed: Signal.Computed<void> | undefined;
	disposed: boolean;
	manualDispose: boolean;
	pending: boolean;
	phase: EffectPhase;
}

export interface SignalWatcherConstructor {
	new (...args: any[]): LitElement & SignalWatcherApi;
}

type LitElementConstructor = new (...args: any[]) => LitElement;

declare function queueMicrotask(callback: () => void): void;
