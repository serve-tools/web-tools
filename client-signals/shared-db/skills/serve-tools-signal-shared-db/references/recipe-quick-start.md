# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-db.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { createEffect, effect } from "@serve-tools/signal-effect";
import type { Query, QueryState } from "@serve-tools/signal-shared-db";
import { SignalDB } from "@serve-tools/signal-shared-db";

interface Schema {
	users: SignalDB.Store<{ id: string; name: string }, string>;
}

/** Runs finite work and owns its queries; the caller still owns the worker port. */
export async function sharedDatabaseQueryRecipe(port: MessagePort) {
	const database = SignalDB.connect<Schema>(port);
	const selectedID = new Signal.State("ada");
	const selectedUser = database.watch("users", selectedID);
	const userKeys = database.watchAllKeys("users", { count: 10 });
	const userCount = database.watchCount("users");

	try {
		await database.put("users", { id: "ada", name: "Ada" });

		const state = selectedUser.get();

		if (state.status === "ready") {
			console.log(state.value?.name);
		}
	} finally {
		selectedUser.dispose();
		userKeys.dispose();
		userCount.dispose();
		database.close();
	}
}

/** Application-owned display state; the underlying QueryState contract is unchanged. */
export interface RetainedQueryState<T> {
	readonly current: QueryState<T>;
	readonly snapshot: Extract<QueryState<T>, { status: "ready" }> | undefined;
}

/** Retires both this application view and its owned query when disposed. */
export interface RetainedQuery<T> {
	readonly state: InstanceType<typeof Signal.Computed<RetainedQueryState<T>>>;
	dispose(): void;
}

/** Owns one fixed logical query and retains every observed successful result, including empty results. */
export function retainQuerySnapshot<T>(query: Query<T>): RetainedQuery<T> {
	let snapshot: RetainedQueryState<T>["snapshot"];
	const state = new Signal.State<RetainedQueryState<T>>({ current: query.get(), snapshot });
	const stop = effect(() => {
		const current = query.get();

		if (current.status === "ready") {
			snapshot = current;
		}

		state.set({ current, snapshot });
	});

	return {
		state: new Signal.Computed(() => state.get()),
		dispose(): void {
			stop();
			query.dispose();
		},
	};
}

/** Mounts a draft editor for one fixed record; the owner must be replaced when its identity changes. */
export function mountDraftEditor<T>(
	query: Query<T | undefined>,
	container: HTMLElement,
	title: (value: T) => string,
): RetainedQuery<T | undefined> {
	const retained = retainQuerySnapshot(query);
	const status = document.createElement("p");

	status.setAttribute("role", "status");
	container.append(status);

	let editor: HTMLElement | undefined;
	let heading: HTMLHeadingElement | undefined;

	const renderer = createEffect(() => {
		const { current, snapshot } = retained.state.get();

		status.textContent =
			current.status === "error"
				? "Query failed: " + String(current.error)
				: current.status === "pending"
					? snapshot === undefined
						? "Loading…"
						: "Refreshing…"
					: snapshot?.value === undefined
						? "Record not found."
						: "";

		if (snapshot === undefined || snapshot.value === undefined) {
			editor?.remove();
			editor = undefined;
			heading = undefined;
			return;
		}

		if (!editor) {
			editor = document.createElement("section");
			heading = document.createElement("h2");

			const label = document.createElement("label");
			const draft = document.createElement("textarea");

			label.append("Unsent comment", draft);
			editor.append(heading, label);
			container.append(editor);
		}

		heading!.textContent = title(snapshot.value);
		// The draft belongs to the editor, not to the refreshed database snapshot.
	});

	const dispose = (): void => {
		renderer.dispose();
		retained.dispose();
		status.remove();
		editor?.remove();
	};

	try {
		renderer.start();
	} catch (error) {
		dispose();

		throw error;
	}

	return { state: retained.state, dispose };
}
```
