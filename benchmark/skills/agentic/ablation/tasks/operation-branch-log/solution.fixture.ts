import { AsyncOperation, AsyncOperationSubscriber } from "@serve-tools/async-operation";

export async function collectEvenSquares(
	values: Iterable<number>,
	listener: (value: number, index: number) => void | Promise<void>,
) {
	if (typeof listener !== "function") {
		throw new TypeError("listener");
	}
	const items = Array.from(values);
	if (items.some((value) => !Number.isFinite(value))) {
		throw new TypeError("values");
	}

	const operation = new AsyncOperation<number, number>(async (write) => {
		for (const value of items) {
			await write(value);
		}
		return items.length;
	});
	const subscriber = new AsyncOperationSubscriber<number, number>();
	const evens: number[] = [];
	subscriber
		.filter((value) => value % 2 === 0)
		.map((value) => value ** 2)
		.subscribe(async (value, index) => {
			evens.push(value);
			await listener(value, index);
		});

	const all = await subscriber.consume(operation);
	return { all, evens: [...evens] };
}
