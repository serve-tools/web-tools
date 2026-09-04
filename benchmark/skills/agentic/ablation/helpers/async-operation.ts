import type { AsyncOperation } from "@serve-tools/async-operation";

/** Collects an owned operation's values and preserves its independent terminal result. */
export async function collectOperation<Value, Result>(
	operation: AsyncOperation<Value, Result>,
): Promise<{
	values: Value[];
	result: Result;
}> {
	const values: Value[] = [];

	for await (const value of operation) {
		values.push(value);
	}

	return { values, result: await operation.result };
}
