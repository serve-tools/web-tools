import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

export async function runPromotedOrder(labels: string[] = ["controlled", "visible"]): Promise<string[]> {
	if (
		!Array.isArray(labels) ||
		labels.length !== 2 ||
		Array.from({ length: labels.length }, (_, index) => !Object.hasOwn(labels, index)).some(Boolean) ||
		!labels.every((label) => typeof label === "string")
	) {
		throw new TypeError("labels must be a dense two-element Array of strings");
	}

	const controller = new TaskController({ priority: "background" });
	const order: string[] = [];
	const controlled = scheduler.postTask(() => order.push(labels[0]!), { signal: controller.signal });
	const visible = scheduler.postTask(() => order.push(labels[1]!), { priority: "user-visible" });
	controller.setPriority("user-blocking");
	await Promise.all([controlled, visible]);
	return order;
}
