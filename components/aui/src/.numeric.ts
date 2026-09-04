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
