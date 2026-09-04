import { AsyncOperation, AsyncOperationSubscriber } from "@serve-tools/async-operation";

export async function collectEvenSquares(values: Iterable<number>, listener: (value: number, index: number) => void) {
	const input = checkedValues(values);
	if (typeof listener !== "function") {
		throw new TypeError("Expected a listener");
	}
	const operation = new AsyncOperation<number, number>(async (write) => {
		let total = 0;
		for (const value of input) {
			++total;
			await write(value);
		}
		return total;
	});
	const subscriber = new AsyncOperationSubscriber<number, number>();
	const evens: number[] = [];
	subscriber
		.filter((value) => value % 2 === 0)
		.map((value) => value ** 2)
		.subscribe(async (value, index) => {
			await listener(value, index);
			evens.push(value);
		});
	const all = await subscriber.consume(operation);
	return { all, evens };
}

function checkedValues(values: Iterable<number>): number[] {
	if (
		values === null ||
		values === undefined ||
		typeof (values as Iterable<number>)[Symbol.iterator] !== "function"
	) {
		throw new TypeError("Expected an iterable");
	}
	if (Array.isArray(values) && Object.keys(values).length !== values.length) {
		throw new TypeError("Expected dense values");
	}
	const output = Array.from(values);
	if (output.some((value) => !Number.isFinite(value))) {
		throw new TypeError("Expected finite values");
	}
	return output;
}
