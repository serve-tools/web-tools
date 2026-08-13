import { Signal } from "@serve-tools/signal";
import { describe, expect, it } from "vitest";

import { SignalArray } from "../src/signal-collections.js";
import { watch } from "./watch.js";

describe("SignalArray", () => {
	it("preserves native identity and initial values", () => {
		const values = new SignalArray([1, 2]);

		expect(Array.isArray(values)).toBe(true);
		expect(values).toBeInstanceOf(Array);
		expect(values).toBeInstanceOf(SignalArray);
		expect(values).toEqual([1, 2]);
	});

	it("preserves non-index properties", () => {
		const values = new SignalArray([1, 2]) as number[] & Record<string, number>;

		values["01"] = 3;
		values["-1"] = 4;

		expect(values.length).toBe(2);
		expect(values["01"]).toBe(3);
		expect(values["-1"]).toBe(4);
	});

	it("isolates direct index reads and ignores identical writes", () => {
		const values = new SignalArray([1, 2]);
		let reads = 0;
		const first = new Signal.Computed(() => {
			reads += 1;
			return values[0];
		});

		expect(first.get()).toBe(1);
		values[1] = 3;
		expect(first.get()).toBe(1);
		values[0] = 1;
		expect(first.get()).toBe(1);
		expect(reads).toBe(1);
		values[0] = 4;
		expect(first.get()).toBe(4);
		expect(reads).toBe(2);
	});

	it("tracks collection reads and length changes", async () => {
		const values = new SignalArray([1]);
		const joined: string[] = [];
		const lengths: number[] = [];
		const stopJoined = watch(
			() => values.join(","),
			(value) => joined.push(value),
		);
		const stopLength = watch(
			() => values.length,
			(value) => lengths.push(value),
		);

		values.push(2);
		await Promise.resolve();

		expect(joined).toEqual(["1,2"]);
		expect(lengths).toEqual([2]);
		stopJoined();
		stopLength();
	});

	it("invalidates deleted, re-added, and truncated indexes", async () => {
		const values = new SignalArray<number>([1, 2, 3]);
		const second: Array<number | undefined> = [];
		const stop = watch(
			() => values[1],
			(value) => second.push(value),
		);

		delete values[1];
		await Promise.resolve();
		values[1] = 4;
		await Promise.resolve();
		values.length = 1;
		await Promise.resolve();

		expect(second).toEqual([undefined, 4, undefined]);
		stop();
	});

	it("returns stable collection method wrappers", () => {
		const values = new SignalArray([1]);

		expect(values.findLast).toBe(values.findLast);
		expect(values.findLastIndex).toBe(values.findLastIndex);
		expect(values.map).toBe(values.map);
		expect(values.toReversed).toBe(values.toReversed);
		expect(values.toSorted).toBe(values.toSorted);
		expect(values.toSpliced).toBe(values.toSpliced);
		expect(values.values).toBe(values.values);
		expect(values.with).toBe(values.with);
	});

	it("passes itself to collection callbacks", () => {
		const values = new SignalArray([1]);
		let owner: number[] | undefined;

		values.forEach((_value, _index, collection) => {
			owner = collection;
		});

		expect(owner).toBe(values);
	});

	it("passes itself to reverse-search callbacks", () => {
		const values = new SignalArray([1]);
		let findOwner: number[] | undefined;
		let indexOwner: number[] | undefined;

		values.findLast((_value, _index, collection) => {
			findOwner = collection;
			return true;
		});
		values.findLastIndex((_value, _index, collection) => {
			indexOwner = collection;
			return true;
		});

		expect(findOwner).toBe(values);
		expect(indexOwner).toBe(values);
	});

	it("preserves callback receivers and reducer owners", () => {
		const values = new SignalArray([1]);
		const thisArg = {};
		let callbackThis: unknown;
		let defaultThis: unknown = thisArg;
		let reducerOwner: number[] | undefined;

		values.find(function (this: unknown) {
			callbackThis = this;
			return false;
		}, thisArg);
		values.find(function (this: unknown) {
			defaultThis = this;
			return false;
		});
		values.reduce((total, value, _index, collection) => {
			reducerOwner = collection;

			return total + value;
		}, 0);

		expect(callbackThis).toBe(thisArg);
		expect(defaultThis).toBeUndefined();
		expect(reducerOwner).toBe(values);
	});

	it("uses one collection dependency for reverse-search and copying methods", () => {
		const reads: Array<(values: SignalArray<number>) => unknown> = [
			(values) => values.findLast(() => false),
			(values) => values.findLastIndex(() => false),
			(values) => values.toReversed(),
			(values) => values.toSorted(),
			(values) => values.toSpliced(1, 1, 4),
			(values) => values.with(1, 4),
		];

		for (const read of reads) {
			const values = new SignalArray([1, 2, 3]);
			const computed = new Signal.Computed(() => read(values));

			computed.get();

			expect(Signal.subtle.introspectSources(computed)).toHaveLength(1);
		}
	});
});
