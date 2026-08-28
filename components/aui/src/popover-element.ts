import { NativePopoverElement } from "./.popover.js";

/** Native popover state forwarded by a popover element. */
export interface PopoverEventMap extends HTMLElementEventMap {
	beforetoggle: ToggleEvent;
	toggle: ToggleEvent;
}

/** Exposes an author-owned direct native popover without replacing its top-layer behavior or CSS geometry. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the interface adds typed DOM event overloads only.
export class PopoverElement extends NativePopoverElement {}

/** Typed native toggle listeners available on popover elements. */
export interface PopoverElement {
	addEventListener<Type extends keyof PopoverEventMap>(
		type: Type,
		listener: (this: PopoverElement, event: PopoverEventMap[Type]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;
}
