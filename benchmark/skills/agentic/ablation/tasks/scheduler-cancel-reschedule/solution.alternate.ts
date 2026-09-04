import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

export async function cancelThenReschedule(reason?: unknown): Promise<{ ran: string[]; cancellation: unknown }> {
	const ran: string[] = [];
	const cancelled = new TaskController();
	const pending = scheduler.postTask(() => ran.push("cancelled"), { delay: 30, signal: cancelled.signal });

	cancelled.abort(reason);

	let cancellation: unknown;
	try {
		await pending;
	} catch (error) {
		cancellation = error;
	}

	const replacement = new TaskController();
	await scheduler.postTask(() => ran.push("replacement"), { signal: replacement.signal });
	return { ran, cancellation };
}
