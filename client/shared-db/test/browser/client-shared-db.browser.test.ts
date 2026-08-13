/// <reference lib="dom" />

import { expect, test } from "vitest";

import { connect, type SharedDBChange } from "../../src/scope/window.js";
import type { TestSchema } from "./shared-db.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("./shared-db.ts", import.meta.url), { name, type: "module" });
	const database = connect<TestSchema>(worker.port);

	return {
		database,
		close(): void {
			database.close();
			worker.port.close();
		},
	};
};

test("coordinates committed database operations and changes through one shared worker", async () => {
	const sharedName = crypto.randomUUID();
	const connections = [open(sharedName), open(sharedName)];
	const [first, second] = connections;
	const observed: Array<Array<SharedDBChange<TestSchema, "users">>> = [[], []];
	const ready = [Promise.withResolvers<number>(), Promise.withResolvers<number>()];
	const subscriptions = connections.map(({ database }, index) =>
		database.subscribe("users", (change) => observed[index]!.push(change), {
			onReady: ready[index]!.resolve,
			onError: ready[index]!.reject,
		}),
	);

	try {
		expect(await Promise.all(ready.map(({ promise }) => promise))).toEqual([0, 0]);

		expect(await first.database.add("users", { id: "a", name: "Ada" })).toBe("a");

		await expect.poll(() => observed.map((changes) => changes.length)).toEqual([1, 1]);
		expect(observed.map(([change]) => change)).toEqual([
			{ kind: "added", store: "users", key: "a", value: { id: "a", name: "Ada" }, revision: 1 },
			{ kind: "added", store: "users", key: "a", value: { id: "a", name: "Ada" }, revision: 1 },
		]);
		expect(await second.database.get("users", "a")).toEqual({ id: "a", name: "Ada" });

		const beforeRejectedMutation = observed.map((changes) => changes.length);

		await expect(second.database.add("users", { id: "a", name: "Duplicate" })).rejects.toMatchObject({
			name: "ConstraintError",
		});
		await Promise.resolve();
		expect(observed.map((changes) => changes.length)).toEqual(beforeRejectedMutation);

		expect(await second.database.put("users", { id: "a", name: "Augusta" })).toBe("a");
		await expect.poll(() => observed.map((changes) => changes.length)).toEqual([2, 2]);
		expect(observed[0]![1]).toEqual({ kind: "invalidated", store: "users", key: "a", revision: 2 });

		await first.database.add("users", { id: "m", name: "Margaret" });
		await first.database.add("users", { id: "z", name: "Zoe" });

		expect(
			await second.database.getAll("users", {
				query: IDBKeyRange.bound("b", "z", false, true),
			}),
		).toEqual([{ id: "m", name: "Margaret" }]);

		await second.database.delete("users", IDBKeyRange.bound("m", "z"));
		await expect.poll(() => observed.map((changes) => changes.length)).toEqual([5, 5]);
		expect(observed[1]!.at(-1)).toEqual({ kind: "invalidated", store: "users", revision: 5 });
		expect(await first.database.getAllKeys("users")).toEqual(["a"]);

		await first.database.delete("users", "a");
		await expect.poll(() => observed.map((changes) => changes.length)).toEqual([6, 6]);
		expect(observed[0]!.at(-1)).toEqual({ kind: "removed", store: "users", key: "a", revision: 6 });

		await first.database.add("logs", "opened");
		await Promise.resolve();
		expect(observed.map((changes) => changes.length)).toEqual([6, 6]);
		expect(await second.database.count("logs")).toBe(1);

		await first.database.add("users", { id: "c", name: "Carol" });
		await second.database.clear("users");
		await expect.poll(() => observed.map((changes) => changes.length)).toEqual([8, 8]);
		expect(observed[0]!.at(-1)).toEqual({ kind: "invalidated", store: "users", revision: 9 });
		expect(await first.database.count("users")).toBe(0);

		const controller = new AbortController();

		controller.abort();
		await expect(first.database.get("users", "a", { signal: controller.signal })).rejects.toMatchObject({
			name: "AbortError",
		});
	} finally {
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
			subscription.unsubscribe();
		});
		connections.forEach((connection) => {
			connection.close();
		});
	}
});
