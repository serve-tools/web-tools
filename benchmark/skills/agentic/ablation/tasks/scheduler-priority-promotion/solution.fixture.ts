import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

export async function runPromotedOrder(
	labels: readonly [string, string] = ["controlled", "visible"],
): Promise<string[]> {
	if (
		!Array.isArray(labels) ||
		labels.length !== 2 ||
		!(0 in labels) ||
		!(1 in labels) ||
		typeof labels[0] !== "string" ||
		typeof labels[1] !== "string"
	) {
		throw new TypeError("Expected two labels");
	}

	const order: string[] = [];
	const controller = new TaskController({ priority: "background" });
	const controlled = scheduler.postTask(() => order.push(labels[0]), { signal: controller.signal });
	const visible = scheduler.postTask(() => order.push(labels[1]), { priority: "user-visible" });

	controller.setPriority("user-blocking");

	await Promise.all([controlled, visible]);

	return order;
}
