import { AsyncOperation } from "../src/operation.js";

await using operation = new AsyncOperation<string, number>(async ({ signal, write }) => {
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
