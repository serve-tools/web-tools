/// <reference lib="dom" />

import { Signal } from "@serve-tools/signal";
import { expect, test, vi } from "vitest";

import { SignalDB } from "../src/signal-shared-db.js";
import { mountDraftEditor } from "./signal-shared-db.recipes.js";
import type { BrowserTestSchema, User } from "./signal-shared-db.worker.js";

const connect = (name: string) => {
	const worker = new SharedWorker(new URL("./signal-shared-db.worker.ts", import.meta.url), { name, type: "module" });
	const database = SignalDB.connect<BrowserTestSchema>(worker.port);

	return {
		database,
		close(): void {
			database.close();
			worker.port.close();
		},
	};
};

const ready = <Value>(value: Value) => ({ status: "ready", value });

const flushEffects = async (): Promise<void> => {
	await new Promise<void>((resolve) => queueMicrotask(resolve));
	await new Promise<void>((resolve) => queueMicrotask(resolve));
};

test("coordinates real shared database operations with reactive signals", async () => {
	const sharedName = crypto.randomUUID();
	const connections = [connect(sharedName), connect(sharedName)];
	const [first, second] = connections;
	const selectedKey = new Signal.State("ada");
	const count = new Signal.State(1);
	const selected = second.database.watch("users", selectedKey);
	const users = first.database.watchAll("users", { count });
	const userKeys = first.database.watchAllKeys("users", { count });
	const userCount = first.database.watchCount("users");
	const ada: User = { id: "ada", name: "Ada" };
	const margaret: User = { id: "margaret", name: "Margaret" };

	try {
		expect(selected.get()).toEqual({ status: "pending" });
		expect(users.get()).toEqual({ status: "pending" });

		await expect
			.poll(() => [selected.get(), users.get(), userKeys.get(), userCount.get()])
			.toEqual([ready(undefined), ready([]), ready([]), ready(0)]);

		expect(await first.database.add("users", ada)).toBe(ada.id);

		await expect
			.poll(() => [selected.get(), users.get(), userKeys.get(), userCount.get()])
			.toEqual([ready(ada), ready([ada]), ready([ada.id]), ready(1)]);

		expect(await second.database.get("users", ada.id)).toEqual(ada);
		expect(await second.database.has("users", ada.id)).toBe(true);

		await expect(second.database.add("users", ada)).rejects.toMatchObject({ name: "ConstraintError" });

		const updatedAda = { ...ada, name: "Augusta" };

		expect(await second.database.put("users", updatedAda)).toBe(ada.id);

		await expect.poll(() => [selected.get(), users.get()]).toEqual([ready(updatedAda), ready([updatedAda])]);

		await first.database.add("users", margaret);

		expect(await second.database.getAllKeys("users")).toEqual([ada.id, margaret.id]);
		expect(await second.database.count("users")).toBe(2);

		count.set(2);

		await expect.poll(() => users.get()).toEqual(ready([updatedAda, margaret]));

		selectedKey.set(margaret.id);

		await expect.poll(() => selected.get()).toEqual(ready(margaret));
		await first.database.delete("users", margaret.id);
		await expect.poll(() => [selected.get(), users.get()]).toEqual([ready(undefined), ready([updatedAda])]);

		expect(await first.database.add("logs", "opened")).toBe(1);
		expect(await second.database.count("logs")).toBe(1);

		const cancelled = new AbortController();

		cancelled.abort();

		await expect(second.database.get("users", ada.id, { signal: cancelled.signal })).rejects.toMatchObject({
			name: "AbortError",
		});

		expect(Signal.subtle.hasSinks(selectedKey)).toBe(true);

		selected.dispose();

		expect(Signal.subtle.hasSinks(selectedKey)).toBe(false);

		await first.database.clear("users");
		await expect.poll(() => users.get()).toEqual(ready([]));

		expect(Signal.subtle.hasSinks(count)).toBe(true);

		first.database.close();

		expect(Signal.subtle.hasSinks(count)).toBe(false);
	} finally {
		selected.dispose();
		users.dispose();
		userKeys.dispose();
		userCount.dispose();

		for (const connection of connections) {
			connection.close();
		}
	}
});

test("preserves a focused draft while a peer write refreshes its query", async () => {
	const sharedName = crypto.randomUUID();
	const connections = [connect(sharedName), connect(sharedName)];
	const [first, second] = connections;
	const ada: User = { id: "ada", name: "Ada" };
	const updatedAda: User = { id: "ada", name: "Augusta" };
	const query = second.database.watch("users", ada.id);
	const container = document.createElement("div");
	const mounted = mountDraftEditor(query, container, (user) => user.name);
	const originalGet = second.database.source.get.bind(second.database.source);
	const getSpy = vi.spyOn(second.database.source, "get");

	document.body.append(container);

	try {
		expect(query.get()).toEqual({ status: "pending" });
		expect(mounted.state.get()).toEqual({ current: { status: "pending" }, snapshot: undefined });
		expect(container.querySelector("[role=status]")?.textContent).toBe("Loading…");
		expect(container.querySelector("textarea")).toBeNull();

		await first.database.put("users", ada);
		await expect.poll(() => query.get()).toEqual(ready(ada));
		await flushEffects();

		const textarea = container.querySelector("textarea")!;

		textarea.value = "Keep this unsent draft";
		textarea.focus();

		expect(document.activeElement).toBe(textarea);
		expect(container.querySelector("h2")?.textContent).toBe("Ada");

		const readStarted = Promise.withResolvers<void>();
		const releaseRead = Promise.withResolvers<void>();

		getSpy.mockImplementationOnce(((storeName, key, options) => {
			const result = originalGet(storeName, key, options);

			readStarted.resolve();

			return releaseRead.promise.then(() => result);
		}) as typeof second.database.source.get);

		await first.database.put("users", updatedAda);
		await readStarted.promise;
		await flushEffects();

		expect(query.get()).toEqual({ status: "pending" });
		expect(mounted.state.get()).toEqual({
			current: { status: "pending" },
			snapshot: { status: "ready", value: ada },
		});
		expect(container.querySelector("[role=status]")?.textContent).toBe("Refreshing…");
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Keep this unsent draft");
		expect(document.activeElement).toBe(textarea);

		releaseRead.resolve();

		await expect.poll(() => query.get()).toEqual(ready(updatedAda));
		await flushEffects();

		expect(container.querySelector("h2")?.textContent).toBe("Augusta");
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Keep this unsent draft");
		expect(document.activeElement).toBe(textarea);

		const failure = new Error("Refresh failed");

		getSpy.mockImplementationOnce((() => Promise.reject(failure)) as typeof second.database.source.get);

		await query.refresh();
		await flushEffects();

		expect(query.get()).toEqual({ status: "error", error: failure });
		expect(container.querySelector("[role=status]")?.textContent).toBe("Query failed: Error: Refresh failed");
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Keep this unsent draft");

		await first.database.delete("users", ada.id);
		await expect.poll(() => query.get()).toEqual(ready(undefined));
		await flushEffects();

		expect(query.get()).toEqual(ready(undefined));
		expect(container.querySelector("[role=status]")?.textContent).toBe("Record not found.");
		expect(container.querySelector("section")).toBeNull();
		expect(container.querySelector("textarea")).toBeNull();

		await first.database.put("users", updatedAda);
		await expect.poll(() => query.get()).toEqual(ready(updatedAda));
		await flushEffects();

		expect(container.querySelector("textarea")).not.toBeNull();

		const lateReadStarted = Promise.withResolvers<void>();
		const lateRead = Promise.withResolvers<User | undefined>();

		getSpy.mockImplementationOnce((() => {
			lateReadStarted.resolve();

			return lateRead.promise;
		}) as typeof second.database.source.get);

		const lateRefresh = query.refresh();

		await lateReadStarted.promise;
		await flushEffects();

		const frozen = mounted.state.get();

		mounted.dispose();

		await expect(lateRefresh).resolves.toBeUndefined();

		lateRead.resolve({ id: "ada", name: "Late" });
		await lateRead.promise;
		await flushEffects();

		expect(container.childElementCount).toBe(0);
		expect(mounted.state.get()).toBe(frozen);
	} finally {
		mounted.dispose();
		getSpy.mockRestore();
		container.remove();

		for (const connection of connections) {
			connection.close();
		}
	}
});

test("the editor recipe cleans up when its initial render throws", async () => {
	const sharedName = crypto.randomUUID();
	const connections = [connect(sharedName), connect(sharedName)];
	const [first, second] = connections;
	const ada: User = { id: "ada", name: "Ada" };
	const container = document.createElement("div");

	try {
		await first.database.put("users", ada);

		const query = second.database.watch("users", ada.id);

		await expect.poll(() => query.get()).toEqual(ready(ada));

		const failure = new Error("Initial render failed");

		expect(() =>
			mountDraftEditor(query, container, () => {
				throw failure;
			}),
		).toThrow(failure);
		expect(container.childElementCount).toBe(0);
		expect(Signal.subtle.hasSinks(query)).toBe(false);
		await expect(query.refresh()).rejects.toMatchObject({ name: "InvalidStateError" });
	} finally {
		container.remove();

		for (const connection of connections) {
			connection.close();
		}
	}
});
