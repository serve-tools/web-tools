import { expect, it } from "vitest";

it("schedules all priorities in a worker", async () => {
	const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

	try {
		const order = await new Promise<string[]>((resolve, reject) => {
			worker.addEventListener("message", (event) => resolve(event.data));
			worker.addEventListener("error", reject);
			worker.postMessage(null);
		});

		expect(order).toEqual(["blocking", "visible", "background"]);
	} finally {
		worker.terminate();
	}
});
