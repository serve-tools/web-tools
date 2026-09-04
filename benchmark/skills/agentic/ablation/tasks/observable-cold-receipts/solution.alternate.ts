import { Observable } from "@serve-tools/ponyfill-observable";

export async function collectReceipts(
	start: () => number,
	onCleanup: (run: number) => void,
): Promise<[number[], number[]]> {
	if (typeof start !== "function" || typeof onCleanup !== "function") {
		throw new TypeError("start and onCleanup must be functions");
	}

	const receipts = new Observable<number>((subscriber) => {
		const run = start();
		subscriber.addTeardown(() => onCleanup(run));
		subscriber.next(run);
		subscriber.next(run + 1);
		subscriber.complete();
	}).map((value) => value * 2);

	return [await receipts.toArray(), await receipts.toArray()];
}
