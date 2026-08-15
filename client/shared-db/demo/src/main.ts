/// <reference lib="dom" />

import { connect } from "@serve-tools/client-shared-db/scope/window";
import type { DemoSchema, Task } from "./database-worker.js";

const query = <ElementType extends Element>(selector: string): ElementType => {
	const element = document.querySelector<ElementType>(selector);

	if (!element) {
		throw new Error(`Missing demo element: ${selector}`);
	}

	return element;
};

const connection = query<HTMLElement>("#connection");
const revision = query<HTMLElement>("#revision");
const list = query<HTMLUListElement>("#tasks");
const empty = query<HTMLElement>("#empty");
const input = query<HTMLInputElement>("#task-title");

if (typeof SharedWorker === "undefined") {
	connection.textContent = "SharedWorker is unavailable in this browser.";
	query<HTMLButtonElement>("#task-form button").disabled = true;
} else {
	const worker = new SharedWorker(new URL("./database-worker.ts", import.meta.url), {
		name: "serve-tools-client-shared-db-demo",
		type: "module",
	});
	const database = connect<DemoSchema>(worker.port);
	let tasks: Task[] = [];

	const render = (): void => {
		list.replaceChildren(...tasks.sort((a, b) => b.updatedAt - a.updatedAt).map(createTask));
		empty.hidden = tasks.length > 0;
	};

	const refresh = async (nextRevision?: number): Promise<void> => {
		tasks = await database.getAll("tasks");
		if (nextRevision !== undefined) {
			revision.textContent = String(nextRevision);
		}
		render();
	};

	const createTask = (task: Task): HTMLLIElement => {
		const item = document.createElement("li");
		const toggle = document.createElement("button");
		const title = document.createElement("span");
		const remove = document.createElement("button");

		item.toggleAttribute("data-done", task.done);
		toggle.className = "toggle";
		toggle.textContent = task.done ? "✓" : "○";
		toggle.ariaLabel = task.done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`;
		toggle.addEventListener("click", () => {
			void database.put("tasks", { ...task, done: !task.done, updatedAt: Date.now() });
		});

		title.textContent = task.title;
		remove.className = "remove";
		remove.textContent = "Remove";
		remove.addEventListener("click", () => void database.delete("tasks", task.id));
		item.append(toggle, title, remove);

		return item;
	};

	const subscription = database.subscribe("tasks", (change) => void refresh(change.revision), {
		onReady: (currentRevision) => {
			connection.textContent = "Connected. Open another tab to share changes.";
			void refresh(currentRevision);
		},
		onError: (error) => {
			connection.textContent = `Connection failed: ${error.message}`;
		},
	});

	query<HTMLFormElement>("#task-form").addEventListener("submit", (event) => {
		event.preventDefault();

		const title = input.value.trim();

		if (!title) {
			return;
		}

		input.value = "";

		void database.add("tasks", {
			done: false,
			id: crypto.randomUUID(),
			title,
			updatedAt: Date.now(),
		});
	});

	query("#clear").addEventListener("click", () => void database.clear("tasks"));

	addEventListener(
		"pagehide",
		() => {
			subscription.unsubscribe();
			database.close();
			worker.port.close();
		},
		{ once: true },
	);
}
