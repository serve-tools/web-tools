/** Replays a pre-upgrade own property through a custom-element accessor. */
export const upgradeProperty = (element: object, property: PropertyKey): void => {
	if (!Object.hasOwn(element, property)) {
		return;
	}
	const record = element as Record<PropertyKey, unknown>;
	const value = record[property];
	delete record[property];
	record[property] = value;
};

/** Copies one attribute without changing its serialized value. */
export const copyAttribute = (source: Element, target: Element, name: string): void => {
	const value = source.getAttribute(name);
	if (value === null) {
		target.removeAttribute(name);
	} else {
		target.setAttribute(name, value);
	}
};
