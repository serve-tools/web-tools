import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

export async function cancelThenReschedule(
	...input: [] | [reason: unknown]
): Promise<{ ran: readonly string[]; cancellation: unknown }> {
	const [reason] = input;
	const ran: string[] = [];
	const controller = new TaskController();
	const cancelled = scheduler.postTask(() => ran.push("cancelled"), { signal: controller.signal, delay: 30 });

	if (input.length === 0) {
		controller.abort();
	} else {
		controller.abort(reason);
	}

	let cancellation: unknown;

	try {
		await cancelled;
	} catch (error) {
		cancellation = error;
	}

	const replacementController = new TaskController();

	await scheduler.postTask(() => ran.push("replacement"), { signal: replacementController.signal });

	return { ran, cancellation };
}
