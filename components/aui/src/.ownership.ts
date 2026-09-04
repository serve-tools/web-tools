type AttributeValue = string | null;

interface OwnedAttribute {
	author: AttributeValue;
	owned: AttributeValue;
}

/** Preserves author attributes while a component temporarily coordinates retained native elements. */
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
