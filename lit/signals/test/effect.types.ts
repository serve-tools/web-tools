import { LitElement } from "lit";
import { effect } from "../src/decorators.js";
import { type EffectCleanup, SignalWatcher, type SignalWatcherApi } from "../src/lit-signals.js";

class EffectElement extends SignalWatcher(LitElement) {
	@effect()
	protected synchronize(): void {}

	@effect({ phase: "before-update" })
	protected prepare(): EffectCleanup {
		return () => {};
	}
}

const element = new EffectElement();

element satisfies SignalWatcherApi;
element.updateEffect(() => {});
element.updateEffect(() => () => {}, { phase: "after-update", manualDispose: true });

class PlainElement extends LitElement {
	// @ts-expect-error effect methods require the SignalWatcher lifecycle API.
	@effect()
	protected synchronize(): void {}
}

void PlainElement;

class InvalidEffectElement extends SignalWatcher(LitElement) {
	// @ts-expect-error effect cleanup must be synchronous.
	@effect()
	protected async synchronize(): Promise<void> {}
}

void InvalidEffectElement;
