import { css, html, repeat, SignalArray, SignalElement, watch } from "@serve-tools/lit-signals";
import { collection } from "@serve-tools/lit-signals/decorators";

interface Task {
	done: boolean;
	id: number;
	title: string;
}

class SignalTaskList extends SignalElement {
	static styles = css`
		:host {
			display: grid;
			gap: 1rem;
			padding: 1.25rem;
			border: 1px solid #9b8eca;
			border-radius: 1rem;
			background: #faf8ffde;
		}

		form,
		li,
		footer {
			display: flex;
			align-items: center;
			gap: 0.65rem;
		}

		input[type="text"] {
			min-width: 0;
			flex: 1;
			padding: 0.65rem;
			border: 1px solid #9b8eca;
			border-radius: 0.5rem;
			font: inherit;
		}

		button {
			padding: 0.55rem 0.75rem;
			border: 0;
			border-radius: 0.5rem;
			color: white;
			background: #6743c8;
			font: inherit;
			font-weight: 700;
			cursor: pointer;
		}

		ul {
			display: grid;
			gap: 0.5rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		li {
			padding: 0.65rem;
			border-radius: 0.5rem;
			background: #eee8fa;
		}

		li span {
			flex: 1;
		}

		li[data-done] span {
			color: #746a87;
			text-decoration: line-through;
		}

		li button {
			padding: 0.25rem 0.45rem;
			color: #6743c8;
			background: transparent;
		}

		footer {
			justify-content: space-between;
			color: #655889;
			font-size: 0.85rem;
		}
	`;

	@collection(SignalArray)
	accessor tasks: Task[] = [
		{ done: false, id: 1, title: "Try direct Signal substitutions" },
		{ done: true, id: 2, title: "Keep keyed DOM stable" },
	];

	#nextID = 3;

	protected render() {
		return html`
			<form @submit=${this.#addTask}>
				<input name="task" type="text" aria-label="New task" placeholder="Add a task" required />
				<button>Add</button>
			</form>
			<ul>
				${repeat(
					() => this.tasks,
					(task) => task.id,
					(task) => html`
						<li ?data-done=${task.done}>
							<input type="checkbox" .checked=${task.done} @change=${() => this.#toggleTask(task)} />
							<span>${task.title}</span>
							<button aria-label=${`Remove ${task.title}`} @click=${() => this.#removeTask(task)}>×</button>
						</li>
					`,
				)}
			</ul>
			<footer>
				<span>${watch(() => this.tasks.length)} tasks</span>
				<span>${watch(() => this.tasks.filter((task) => task.done).length)} complete</span>
			</footer>
		`;
	}

	readonly #addTask = (event: SubmitEvent): void => {
		event.preventDefault();

		const form = event.currentTarget as HTMLFormElement;
		const input = form.elements.namedItem("task") as HTMLInputElement;

		this.tasks.push({ done: false, id: this.#nextID, title: input.value });
		++this.#nextID;
		form.reset();
	};

	#removeTask(task: Task): void {
		const index = this.tasks.findIndex(({ id }) => id === task.id);

		if (index !== -1) {
			this.tasks.splice(index, 1);
		}
	}

	#toggleTask(task: Task): void {
		const index = this.tasks.findIndex(({ id }) => id === task.id);

		if (index !== -1) {
			this.tasks[index] = { ...task, done: !task.done };
		}
	}
}

customElements.define("signal-task-list", SignalTaskList);
