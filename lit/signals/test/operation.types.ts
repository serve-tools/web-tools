import { LitElement } from "lit";

import type { OperationOptions } from "../src/decorators.js";
import { operation } from "../src/decorators.js";
import { AsyncOperationSubscriber, SignalElement, watch } from "../src/lit-signals.js";

const progress = new AsyncOperationSubscriber<number>();
const progressLabel = progress.map((value) => `${value}%`);

class OperationElement extends SignalElement {
	@operation(progressLabel, { disconnectDelay: () => 0 })
	accessor progress = "Waiting";
}

class FineGrainedOperationElement extends LitElement {
	@operation(progressLabel)
	accessor progress = "Waiting";

	protected override render() {
		return watch(() => this.progress);
	}
}

class InvalidOperationElement extends SignalElement {
	// @ts-expect-error The operation view value must match the accessor value.
	@operation(progress)
	accessor status = "Waiting";
}

const options: OperationOptions = { disconnectDelay: 10 };
const element = new OperationElement();
const label: string = element.progress;

void FineGrainedOperationElement;
void InvalidOperationElement;
void label;
void options;
