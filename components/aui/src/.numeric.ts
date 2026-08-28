type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

/** Preserves author attributes while a component temporarily coordinates a retained native element. */
export class OwnedAttributes {
	readonly #elements = new Map<Element, Map<string, OwnedAttribute>>();

	author(element: Element, name: string): AttributeValue {
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
		const attributes = this.#elements.get(element);
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
			this.#elements.delete(element);
		}
	}

	release(element: Element): void {
		for (const name of [...(this.#elements.get(element)?.keys() ?? [])]) {
			this.releaseAttribute(element, name);
		}
	}

	#capture(element: Element, name: string): OwnedAttribute {
		let attributes = this.#elements.get(element);
		if (!attributes) {
			this.#elements.set(element, (attributes = new Map()));
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

/** Replays a pre-upgrade own property through a custom-element accessor. */
export const upgradeProperty = (element: object, property: string): void => {
	if (!Object.hasOwn(element, property)) {
		return;
	}
	const record = element as Record<string, unknown>;
	const value = record[property];
	delete record[property];
	record[property] = value;
};

export const isDirectInput = (host: Element, element: Element): element is HTMLInputElement =>
	element.parentElement === host &&
	element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
	element.localName === "input";

export const isDirectButton = (host: Element, element: Element): element is HTMLButtonElement =>
	element.parentElement === host &&
	element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
	element.localName === "button";

export const isFormElement = (document: Document, value: EventTarget | null): value is HTMLFormElement => {
	const Form = document.defaultView?.HTMLFormElement ?? HTMLFormElement;
	return value instanceof Form;
};
