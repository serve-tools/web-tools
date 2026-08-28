/** Private state exposed by one collapsible to its current direct accordion. */
export interface DisclosureHandle {
	readonly button: HTMLButtonElement | null;
	readonly disabled: boolean;
	readonly element: HTMLElement;
	readonly hasValue: boolean;
	readonly open: boolean;
	readonly value: string;
	releaseAccordion(accordion: AccordionController): void;
	setAccordionDisabled(accordion: AccordionController, disabled: boolean): void;
	setOpen(open: boolean): void;
}

/** Private identity and revision held across one complete accordion user transaction. */
export interface AccordionActivation {
	readonly revision: number;
}

/** Private synchronous transaction boundary exposed by an accordion. */
export interface AccordionController {
	readonly changing: boolean;
	readonly revision: number;
	activate(
		activation: AccordionActivation,
		disclosure: DisclosureHandle,
		open: boolean,
		sourceEvent: MouseEvent,
		notify: () => void,
	): boolean;
	beginActivation(disclosure: DisclosureHandle): AccordionActivation | undefined;
	endActivation(activation: AccordionActivation): void;
	has(disclosure: DisclosureHandle): boolean;
	memberChanged(disclosure: DisclosureHandle): void;
	setOpen(disclosure: DisclosureHandle, open: boolean): void;
}

const disclosures = new WeakMap<HTMLElement, DisclosureHandle>();
const accordions = new WeakMap<HTMLElement, AccordionController>();

export const registerDisclosure = (element: HTMLElement, disclosure: DisclosureHandle): void => {
	disclosures.set(element, disclosure);
};

export const getDisclosure = (element: Element): DisclosureHandle | undefined =>
	disclosures.get(element as HTMLElement);

export const registerAccordion = (element: HTMLElement, accordion: AccordionController): void => {
	accordions.set(element, accordion);
};

export const getDirectAccordion = (disclosure: DisclosureHandle): AccordionController | undefined => {
	const parent = disclosure.element.parentElement;
	return parent ? accordions.get(parent) : undefined;
};

export const getAccordion = (disclosure: DisclosureHandle): AccordionController | undefined => {
	const accordion = getDirectAccordion(disclosure);
	return accordion?.has(disclosure) ? accordion : undefined;
};
