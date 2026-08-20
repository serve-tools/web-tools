import { scheduler } from "../src/ponyfill-prioritized-task-scheduling.js";

globalThis.addEventListener("message", async () => {
	const order: string[] = [];

	await Promise.all([
		scheduler.postTask(() => order.push("background"), { priority: "background" }),
		scheduler.postTask(() => order.push("blocking"), { priority: "user-blocking" }),
		scheduler.postTask(() => order.push("visible")),
	]);

	(globalThis as unknown as { postMessage(value: unknown): void }).postMessage(order);
});
