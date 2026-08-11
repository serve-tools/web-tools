/// <reference lib="dom" />

import { client } from "./client.js";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) throw new Error(`Missing demo element: ${selector}`);

	return element;
};

const output = query<HTMLOutputElement>("output");

const show = (message: string): void => {
	output.value = message;
};

const describeError = (error: unknown): string =>
	error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const listen = (element: Element, type: string, listener: (event: Event) => void | Promise<void>): void => {
	element.addEventListener(type, async (event) => {
		try {
			await listener(event);
		} catch (error) {
			show(describeError(error));
		}
	});
};

const setupRequests = (): void => {
	listen(query("form"), "submit", async (event) => {
		event.preventDefault();
		show(await client.request("greet", query<HTMLInputElement>("#name").value));
	});

	listen(query("#fail"), "click", async () => {
		await client.request("fail");
	});
};

const setupSharedState = (): void => {
	const total = query<HTMLElement>("#total");
	const subscription = client.subscribe("totals", (value) => {
		total.textContent = value.toLocaleString();
		show(`Observed total ${value.toLocaleString()} from the SharedWorker.`);
	});

	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-amount]")) {
		listen(button, "click", async () => {
			const amount = Number(button.dataset.amount);
			const value = await client.request("increment", amount);

			show(`Request settled with ${value.toLocaleString()}. Every subscriber receives the same value.`);
		});
	}

	addEventListener("pagehide", () => subscription.unsubscribe(), { once: true });
};

const setupCancellation = (): void => {
	const start = query<HTMLButtonElement>("#start");
	const cancel = query<HTMLButtonElement>("#cancel");
	let controller: AbortController | undefined;

	listen(start, "click", async () => {
		controller?.abort();
		controller = new AbortController();
		start.disabled = true;
		cancel.disabled = false;
		show("The worker is waiting for 10 seconds…");

		try {
			show(await client.request("wait", 10_000, { signal: controller.signal }));
		} catch (error) {
			show(describeError(error));
		} finally {
			controller = undefined;
			start.disabled = false;
			cancel.disabled = true;
		}
	});

	listen(cancel, "click", () => controller?.abort(new DOMException("Request cancelled", "AbortError")));
};

const setupTransfers = (): void => {
	listen(query("form"), "submit", async (event) => {
		event.preventDefault();

		const size = query<HTMLInputElement>("#size").valueAsNumber * 1024;
		const bytes = new Uint8Array(size);

		for (let index = 0; index < bytes.length; ++index) bytes[index] = index % 251;

		const first = bytes[0];
		const last = bytes.at(-1);
		const result = await client.request("reverse", bytes.buffer, { transfer: [bytes.buffer] });
		const reversed = new Uint8Array(result);

		show(
			`Transferred ${size.toLocaleString()} bytes.\n` +
				`Original buffer after send: ${bytes.byteLength} bytes.\n` +
				`Returned endpoints: ${reversed[0]} … ${reversed.at(-1)} (expected ${last} … ${first}).`,
		);
	});
};

const setups: Record<string, () => void> = {
	requests: setupRequests,
	"shared-state": setupSharedState,
	cancellation: setupCancellation,
	transfers: setupTransfers,
};
const setup = setups[document.body.dataset.demo ?? ""];

if (setup) setup();
