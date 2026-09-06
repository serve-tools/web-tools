import { BaseElement } from "@serve-tools/base-components/base";
import { html } from "@serve-tools/base-components/template";
import { ContextConsumer, ContextProvider, createContext } from "@serve-tools/client-context";
import { observeDropTarget } from "@serve-tools/client-input/drop";
import { Signal } from "@serve-tools/signal";

const workspaceContext = createContext<string>(Symbol("gallery-workspace"));

/** Example provider using the existing context package, without adding an Base context implementation. */
export class GalleryWorkspaceElement extends BaseElement {
	static readonly observedAttributes = ["value"];
	#provider = new ContextProvider(this, {
		context: workspaceContext,
		initialValue: this.getAttribute("value") ?? "",
	});

	attributeChangedCallback(): void {
		this.#provider.setValue(this.getAttribute("value") ?? "");
	}

	protected override connect(connection: BaseElement.Connection): void {
		connection.addCleanup(() => this.#provider.disconnect());
		this.#provider.connect();
	}
}

/** Example subscribing consumer whose layout and local child state survive a provider move. */
export class GalleryContextElement extends BaseElement {
	#value = new Signal.State("No workspace provider");
	#consumer = new ContextConsumer(this, {
		context: workspaceContext,
		subscribe: true,
		callback: (value) => this.#value.set(value),
	});

	protected override layout() {
		return html`<output>Current workspace: ${this.#value}</output>`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		connection.addCleanup(() => this.#consumer.disconnect());
		this.#consumer.connect();
	}

	protected override moved(): void {
		this.#consumer.refresh();
	}
}

/** Example native drop target using an abortable observer owned by the Base connection interval. */
export class GalleryDropElement extends BaseElement {
	#internals = this.attachInternals();
	#value = new Signal.State("No token received.");

	receive(value: string): void {
		this.#value.set(value ? `Received: ${value}` : "No token received.");
	}

	protected override layout() {
		return html`<output>${this.#value}</output>`;
	}

	protected override connect(connection: BaseElement.Connection): void {
		const accepts = (event: DragEvent): boolean => event.dataTransfer?.types.includes("text/plain") ?? false;
		observeDropTarget(
			this,
			{
				start: (event) => {
					if (accepts(event)) {
						this.#internals.states.add("drop-active");
					}
				},
				over: (event) => {
					if (accepts(event)) {
						event.preventDefault();
					}
				},
				end: (state, event) => {
					this.#internals.states.delete("drop-active");
					if (state.reason === "drop" && event && accepts(event)) {
						event.preventDefault();
						this.receive(event.dataTransfer!.getData("text/plain"));
					}
				},
			},
			{ signal: connection.signal },
		);
	}
}
