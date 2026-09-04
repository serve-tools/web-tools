import { Observable } from "@serve-tools/ponyfill-observable";

export async function collectReceipts(
	start: () => number,
	onCleanup: (run: number) => void,
): Promise<readonly [number[], number[]]> {
	if (typeof start !== "function" || typeof onCleanup !== "function") {
		throw new TypeError("Expected callbacks");
	}

	const source = new Observable<number>((subscriber) => {
		const run = start();

		subscriber.addTeardown(() => onCleanup(run));
		subscriber.next(run);
		subscriber.next(run + 1);
		subscriber.complete();
	}).map((value) => value * 2);

	return [await source.toArray(), await source.toArray()];
}
