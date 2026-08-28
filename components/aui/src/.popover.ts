import { AUIElement } from "./aui-element.js";

const htmlNamespace = "http://www.w3.org/1999/xhtml";

/** Shared native-popover delegation for overlay components. */
export abstract class NativePopoverElement extends AUIElement {
	/** The first author-owned direct HTML child carrying a `popover` attribute. */
	get popup(): HTMLElement | null {
		return this.findPopup() ?? null;
	}

	/** Whether the current native popup is open in the top layer. */
	get open(): boolean {
		return this.popup?.matches(":popover-open") ?? false;
	}

	/** Shows the current native popup, optionally associating an invoker as its source. */
	show(source?: HTMLElement): void {
		this.requirePopup().showPopover(source ? { source } : undefined);
	}

	/** Hides the current native popup. */
	hide(): void {
		this.requirePopup().hidePopover();
	}

	/** Toggles the current native popup, optionally associating an invoker as its source. */
	toggle(source?: HTMLElement): boolean {
		return this.requirePopup().togglePopover(source ? { source } : undefined);
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.addEventListener("beforetoggle", this.#onBeforeToggle, { capture: true, signal: connection.signal });
		this.addEventListener("toggle", this.#onToggle, { capture: true, signal: connection.signal });
	}

	/** Receives the current popup's native toggle after the host event has been forwarded. */
	protected toggled(_event: ToggleEvent): void {}

	/** Receives the current popup's native beforetoggle after the host event has been forwarded. */
	protected beforeToggled(_event: ToggleEvent): void {}

	protected findPopup(): HTMLElement | undefined {
		for (const child of this.children) {
			if (child.namespaceURI === htmlNamespace && child.hasAttribute("popover")) {
				return child as HTMLElement;
			}
		}

		return undefined;
	}

	protected requirePopup(): HTMLElement {
		const popup = this.popup;
		if (popup) {
			return popup;
		}

		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception("Overlay element requires a direct child with a popover attribute", "InvalidStateError");
	}

	#onBeforeToggle = (event: ToggleEvent): void => {
		if (event.target !== this.findPopup()) {
			return;
		}

		const ToggleEventConstructor = this.ownerDocument.defaultView?.ToggleEvent ?? ToggleEvent;
		const forwarded = new ToggleEventConstructor("beforetoggle", {
			cancelable: event.cancelable,
			newState: event.newState,
			oldState: event.oldState,
			source: event.source,
		});
		if (!this.dispatchEvent(forwarded)) {
			event.preventDefault();
		}
		if (event.target !== this.findPopup()) {
			if (event.newState === "open") {
				event.preventDefault();
			}
			return;
		}
		this.beforeToggled(event);
	};

	#onToggle = (event: ToggleEvent): void => {
		if (event.target !== this.findPopup()) {
			return;
		}

		const ToggleEventConstructor = this.ownerDocument.defaultView?.ToggleEvent ?? ToggleEvent;
		const forwarded = new ToggleEventConstructor("toggle", {
			newState: event.newState,
			oldState: event.oldState,
			source: event.source,
		});
		this.dispatchEvent(forwarded);
		if (event.target !== this.findPopup()) {
			return;
		}
		this.toggled(event);
	};
}

export type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

/** Restores attributes when an overlay stops controlling a replaced authored node. */
export class AttributeOwner {
	#attributes = new Map<Element, Map<string, OwnedAttribute>>();

	authorValue(element: Element, name: string): AttributeValue {
		return this.#capture(element, name).author;
	}

	own(element: Element, name: string, value: AttributeValue): void {
		const state = this.#capture(element, name);
		const current = element.getAttribute(name);
		if (current !== value) {
			if (value === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, value);
			}
		}
		state.owned = value;
	}

	releaseAttribute(element: Element, name: string): void {
		const attributes = this.#attributes.get(element);
		const state = attributes?.get(name);
		if (!attributes || !state) {
			return;
		}

		if (element.getAttribute(name) === state.owned) {
			if (state.author === null) {
				element.removeAttribute(name);
			} else {
				element.setAttribute(name, state.author);
			}
		}
		attributes.delete(name);
		if (attributes.size === 0) {
			this.#attributes.delete(element);
		}
	}

	release(element: Element): void {
		const names = [...(this.#attributes.get(element)?.keys() ?? [])];
		for (const name of names) {
			this.releaseAttribute(element, name);
		}
	}

	#capture(element: Element, name: string): OwnedAttribute {
		let attributes = this.#attributes.get(element);
		if (!attributes) {
			this.#attributes.set(element, (attributes = new Map()));
		}

		const current = element.getAttribute(name);
		let state = attributes.get(name);
		if (!state) {
			state = { author: current, owned: current };
			attributes.set(name, state);
		} else if (current !== state.owned) {
			state.author = current;
		}

		return state;
	}
}
