import type { EffectCallback, EffectOptions, SignalWatcherApi } from "../mixins/SignalWatcher.js";

/** Configures an effect method owned by a signal-watching Lit element. */
export type EffectDecoratorOptions = Omit<EffectOptions, "manualDispose">;

/** Registers a method as a lifecycle-owned signal update effect. */
export const effect =
	<This extends SignalWatcherApi>(options: EffectDecoratorOptions = {}) =>
	(
		method: (this: This) => ReturnType<EffectCallback>,
		{ addInitializer }: ClassMethodDecoratorContext<This, (this: This) => ReturnType<EffectCallback>>,
	): void => {
		addInitializer(function (): void {
			this.updateEffect(() => method.call(this), options);
		});
	};
