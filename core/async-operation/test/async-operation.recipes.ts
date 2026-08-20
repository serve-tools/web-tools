import { AsyncOperation, AsyncOperationSubscriber } from "../src/operation.js";

await using operation = new AsyncOperation<string, number>(async (write, { signal }) => {
	if (signal.aborted) {
		throw signal.reason;
	}

	await write("connecting");
	await write("ready");

	return 2;
});

for await (const value of operation) {
	console.log(value);
}

console.log(await operation.result);

await using subscriber = new AsyncOperationSubscriber<number, string>();
using _evenValues = subscriber
	.filter((value) => value % 2 === 0)
	.subscribe((value) => {
		console.log(value);
	});

await subscriber.consume(
	new AsyncOperation<number, string>(async (write) => {
		await write(1);
		await write(2);

		return "complete";
	}),
);
