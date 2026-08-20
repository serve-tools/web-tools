/// <reference lib="esnext.disposable" preserve="true" />

import { AsyncOperation, AsyncOperationSubscriber, html, SignalElement } from "@serve-tools/lit-signals";
import { operation } from "@serve-tools/lit-signals/decorators";

const delay = (duration: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		const abort = (): void => {
			clearTimeout(timeout);
			reject(signal.reason);
		};
		const finish = (): void => {
			signal.removeEventListener("abort", abort);
			resolve();
		};
		const timeout = setTimeout(finish, duration);

		if (signal.aborted) {
			abort();
		} else {
			signal.addEventListener("abort", abort, { once: true });
		}
	});

const progress = new AsyncOperationSubscriber<number>();

class ProgressElement extends SignalElement {
	@operation(progress.filter((value) => value > 0).map((value) => `${value}%`))
	accessor #progress = "Starting…";

	protected override render() {
		return html`<output>${this.#progress}</output>`;
	}
}

const startOperation = () =>
	progress.consume(
		new AsyncOperation<number>(async (write, { signal }) => {
			await write(25);
			await delay(1_000, signal);

			await write(50);
			await delay(1_000, signal);

			await write(75);
			await delay(1_000, signal);

			await write(100);
		}),
	);

customElements.define("signal-progress", ProgressElement);

void startOperation();
