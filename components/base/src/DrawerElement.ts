import type { PointerEndState, PointerState } from "@serve-tools/client-input";
import { observePointer } from "@serve-tools/client-input";
import { upgradeProperty } from "./_upgrade.js";
import { BaseElement } from "./BaseElement.js";

export type DrawerSide = "bottom" | "left" | "right" | "top";

export interface DrawerSnapDetail {
	readonly snapPoint: number;
	readonly sourceEvent: PointerEvent;
}

export interface DrawerEventMap extends HTMLElementEventMap {
	beforesnap: CustomEvent<DrawerSnapDetail>;
	snapchange: CustomEvent<DrawerSnapDetail>;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const sides = new Set<DrawerSide>(["bottom", "left", "right", "top"]);
const defaultSnapPoints = Object.freeze([0, 1]);

interface DrawerDrag {
	dialog: HTMLDialogElement;
	document: Document;
	extent: number;
	handle: HTMLElement;
	revision: number;
	side: DrawerSide;
	signal: AbortSignal;
	startPoint: number;
	startTime: number;
}

interface PendingClose {
	detail: DrawerSnapDetail;
	drag: DrawerDrag;
}

interface HandleStyle {
	authorPriority: string;
	authorValue: string;
}

/** Adds handle-only snap gestures to one author-owned native dialog. */
export class DrawerElement extends BaseElement {
	static readonly observedAttributes = ["side"];

	#dialog: HTMLDialogElement | undefined;
	#drag: DrawerDrag | undefined;
	#frameCancel: (() => void) | undefined;
	#handle: HTMLElement | undefined;
	#handleStyle: HandleStyle | undefined;
	#handleStyleObserver: MutationObserver | undefined;
	#pointerCleanup: (() => void) | undefined;
	#pendingCloses: PendingClose[] = [];
	#progress = 1;
	#ready = false;
	#revision = 0;
	#signal: AbortSignal | undefined;
	#snapPoint = 1;
	#snapPoints: readonly number[] = defaultSnapPoints;

	declare addEventListener: {
		<Type extends keyof DrawerEventMap>(
			type: Type,
			listener: (this: DrawerElement, event: DrawerEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};
	declare removeEventListener: {
		<Type extends keyof DrawerEventMap>(
			type: Type,
			listener: (this: DrawerElement, event: DrawerEventMap[Type]) => unknown,
			options?: boolean | EventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | EventListenerOptions,
		): void;
	};

	constructor() {
		super();
		for (const property of ["side", "snapPoints", "snapPoint"] as const) {
			upgradeProperty(this, property);
		}
		this.#ready = true;
	}

	get dialog(): HTMLDialogElement | null {
		return this.#findDialog() ?? null;
	}

	get open(): boolean {
		return this.dialog?.open ?? false;
	}

	get returnValue(): string {
		return this.dialog?.returnValue ?? "";
	}

	get side(): DrawerSide {
		const side = this.getAttribute("side");
		return sides.has(side as DrawerSide) ? (side as DrawerSide) : "bottom";
	}

	set side(value: DrawerSide) {
		if (!sides.has(value)) {
			throw new TypeError("Drawer side must be top, right, bottom, or left");
		}
		this.setAttribute("side", value);
	}

	get snapPoints(): readonly number[] {
		return this.#snapPoints;
	}

	set snapPoints(value: readonly number[]) {
		if (
			!Array.isArray(value) ||
			value.length === 0 ||
			value.some((point) => !Number.isFinite(point) || point < 0 || point > 1)
		) {
			throw new TypeError("Drawer snapPoints must be a nonempty array of finite fractions from 0 through 1");
		}
		const points = [...new Set(value)].sort((left, right) => left - right);
		this.#snapPoints = Object.freeze(points);
		this.snapTo(this.#nearest(this.#snapPoint));
	}

	get snapPoint(): number {
		return this.#snapPoint;
	}

	set snapPoint(value: number) {
		this.snapTo(value);
	}

	show(): void {
		this.#requireDialog().show();
		this.#prepareOpen();
	}

	showModal(): void {
		this.#requireDialog().showModal();
		this.#prepareOpen();
	}

	close(returnValue?: string): void {
		this.#requireDialog().close(returnValue);
	}

	snapTo(value: number): void {
		if (!Number.isFinite(value) || value < 0 || value > 1) {
			throw new TypeError("Drawer snapPoint must be a finite fraction from 0 through 1");
		}
		++this.#revision;
		this.#snapPoint = value;
		if (this.#ready) {
			this.#writeProgress(value);
		}
	}

	attributeChangedCallback(): void {
		if (this.#ready) {
			this.#writeProgress(this.#progress);
		}
	}

	protected override connect(connection: BaseElement.Connection): void {
		this.#signal = connection.signal;
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => this.#reconcile());
		connection.addCleanup(() => {
			observer.disconnect();
			this.#pendingCloses = [];
			this.#releaseHandle();
			this.#dialog = undefined;
			this.#signal = undefined;
			this.#cancelFrame();
			this.#writeProgress(this.#snapPoint);
		});
		observer.observe(this, { attributeFilter: ["slot"], attributes: true, childList: true, subtree: true });
		this.addEventListener("cancel", this.#onCancel, { capture: true, signal: connection.signal });
		this.addEventListener("close", this.#onClose, { capture: true, signal: connection.signal });
		this.#reconcile();
		this.#writeProgress(this.#snapPoint);
	}

	#findDialog(): HTMLDialogElement | undefined {
		const matches = [...this.children].filter(
			(child): child is HTMLDialogElement => child.namespaceURI === htmlNamespace && child.localName === "dialog",
		);
		return matches.length === 1 ? matches[0] : undefined;
	}

	#findHandle(dialog: HTMLDialogElement | undefined): HTMLElement | undefined {
		if (!dialog) {
			return undefined;
		}
		const handles = [...dialog.children].filter(
			(child): child is HTMLElement =>
				child.namespaceURI === htmlNamespace && (child as HTMLElement).slot === "handle",
		);
		return handles.length === 1 ? handles[0] : undefined;
	}

	#reconcile(): void {
		const dialog = this.#findDialog();
		const handle = this.#findHandle(dialog);
		if (dialog !== this.#dialog) {
			this.#pendingCloses = [];
		}
		this.#dialog = dialog;
		if (handle === this.#handle) {
			return;
		}
		this.#releaseHandle();
		if (!handle || !this.#signal || this.#signal.aborted) {
			return;
		}

		this.#handle = handle;
		this.#handleStyle = {
			authorPriority: handle.style.getPropertyPriority("touch-action"),
			authorValue: handle.style.getPropertyValue("touch-action"),
		};
		if (handle.style.getPropertyPriority("touch-action") !== "") {
			handle.style.removeProperty("touch-action");
		}
		handle.style.setProperty("touch-action", "none", "");
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		this.#handleStyleObserver = new Observer(() => {
			if (
				!this.#handleStyle ||
				(handle.style.getPropertyValue("touch-action") === "none" &&
					handle.style.getPropertyPriority("touch-action") === "")
			) {
				return;
			}
			this.#handleStyle.authorValue = handle.style.getPropertyValue("touch-action");
			this.#handleStyle.authorPriority = handle.style.getPropertyPriority("touch-action");
			if (this.#handleStyle.authorPriority !== "") {
				handle.style.removeProperty("touch-action");
			}
			handle.style.setProperty("touch-action", "none", "");
		});
		this.#handleStyleObserver.observe(handle, { attributeFilter: ["style"], attributes: true });
		this.#pointerCleanup = observePointer(
			handle,
			{ start: this.#startDrag, move: this.#moveDrag, end: this.#endDrag },
			{ signal: this.#signal },
		);
	}

	#releaseHandle(): void {
		this.#pointerCleanup?.();
		this.#pointerCleanup = undefined;
		this.#handleStyleObserver?.disconnect();
		this.#handleStyleObserver = undefined;
		if (
			this.#handle &&
			this.#handleStyle &&
			this.#handle.style.getPropertyValue("touch-action") === "none" &&
			this.#handle.style.getPropertyPriority("touch-action") === ""
		) {
			if (this.#handleStyle.authorValue === "") {
				this.#handle.style.removeProperty("touch-action");
			} else {
				this.#handle.style.setProperty(
					"touch-action",
					this.#handleStyle.authorValue,
					this.#handleStyle.authorPriority,
				);
			}
		}
		this.#handle = undefined;
		this.#handleStyle = undefined;
	}

	#startDrag = (_state: PointerState, event: PointerEvent): boolean => {
		const dialog = this.#dialog;
		const handle = this.#handle;
		const signal = this.#signal;
		if (
			event.defaultPrevented ||
			!event.isPrimary ||
			event.button !== 0 ||
			!dialog?.open ||
			!handle ||
			!signal ||
			signal.aborted ||
			this.#findDialog() !== dialog ||
			this.#findHandle(dialog) !== handle
		) {
			return false;
		}
		event.preventDefault();
		const rect = dialog.getBoundingClientRect();
		const side = this.side;
		this.#drag = {
			dialog,
			document: this.ownerDocument,
			extent: Math.max(1, side === "left" || side === "right" ? rect.width : rect.height),
			handle,
			revision: this.#revision,
			side,
			signal,
			startPoint: this.#snapPoint,
			startTime: event.timeStamp,
		};
		this.toggleAttribute("data-dragging", true);
		return true;
	};

	#moveDrag = (state: PointerState): void => {
		const drag = this.#drag;
		if (!drag || !this.#isCurrentDrag(drag)) {
			this.#stopDrag();
			return;
		}
		this.#progress = this.#dragProgress(drag, state);
		if (this.#frameCancel) {
			return;
		}
		const view = this.ownerDocument.defaultView;
		const request = view?.requestAnimationFrame.bind(view) ?? requestAnimationFrame;
		const cancel = view?.cancelAnimationFrame.bind(view) ?? cancelAnimationFrame;
		const frame = request(() => {
			this.#frameCancel = undefined;
			this.#writeProgress(this.#progress);
		});
		this.#frameCancel = () => cancel(frame);
	};

	#endDrag = (state: PointerEndState, event: PointerEvent | undefined): void => {
		const drag = this.#drag;
		this.#drag = undefined;
		this.toggleAttribute("data-dragging", false);
		this.#cancelFrame();
		if (!drag || state.reason !== "up" || !event || !this.#isCurrentDrag(drag)) {
			this.#writeProgress(this.#snapPoint);
			return;
		}

		const elapsed = Math.max(1, event.timeStamp - drag.startTime);
		const closingDelta = this.#closingDelta(drag.side, state);
		const projected = drag.startPoint - (closingDelta + (closingDelta / elapsed) * 120) / drag.extent;
		this.#requestUserSnap(this.#nearest(projected), event, drag);
	};

	#requestUserSnap(point: number, sourceEvent: PointerEvent, drag: DrawerDrag): void {
		const detail = Object.freeze({ snapPoint: point, sourceEvent });
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<DrawerSnapDetail>("beforesnap", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail,
		});
		if (!this.dispatchEvent(proposal) || !this.#isCurrentDrag(drag) || !drag.dialog.open) {
			if (this.#isCurrentGesture(drag)) {
				this.#writeProgress(this.#snapPoint);
			}
			return;
		}

		if (point === 0) {
			const pending = { detail, drag };
			this.#pendingCloses.push(pending);
			drag.dialog.requestClose();
			if (drag.dialog.open) {
				const pendingIndex = this.#pendingCloses.indexOf(pending);
				if (pendingIndex !== -1) {
					this.#pendingCloses.splice(pendingIndex, 1);
				}
				if (this.#isCurrentGesture(drag)) {
					this.#writeProgress(this.#snapPoint);
				}
				return;
			}
			return;
		}
		this.snapTo(point);
		this.dispatchEvent(
			new EventConstructor<DrawerSnapDetail>("snapchange", { bubbles: true, composed: true, detail }),
		);
	}

	#isCurrentGesture(drag: DrawerDrag): boolean {
		return (
			!drag.signal.aborted &&
			this.#signal === drag.signal &&
			this.ownerDocument === drag.document &&
			this.#findDialog() === drag.dialog &&
			this.#findHandle(drag.dialog) === drag.handle
		);
	}

	#isCurrentDrag(drag: DrawerDrag): boolean {
		return this.#isCurrentGesture(drag) && this.#revision === drag.revision && this.side === drag.side;
	}

	#stopDrag(): void {
		this.#drag = undefined;
		this.toggleAttribute("data-dragging", false);
		this.#cancelFrame();
		this.#writeProgress(this.#snapPoint);
	}

	#dragProgress(drag: DrawerDrag, state: PointerState): number {
		return Math.min(1, Math.max(0, drag.startPoint - this.#closingDelta(drag.side, state) / drag.extent));
	}

	#closingDelta(side: DrawerSide, state: PointerState): number {
		switch (side) {
			case "top":
				return -state.delta.y;
			case "left":
				return -state.delta.x;
			case "right":
				return state.delta.x;
			default:
				return state.delta.y;
		}
	}

	#nearest(value: number): number {
		return this.#snapPoints.reduce((nearest, point) =>
			Math.abs(point - value) < Math.abs(nearest - value) ? point : nearest,
		);
	}

	#writeProgress(progress: number): void {
		this.#progress = progress;
		const dialog = this.#dialog ?? this.#findDialog();
		const rect = dialog?.getBoundingClientRect();
		const extent = rect ? (this.side === "left" || this.side === "right" ? rect.width : rect.height) : 0;
		const sign = this.side === "left" || this.side === "top" ? -1 : 1;
		this.style.setProperty("--base-drawer-progress", String(progress));
		this.style.setProperty("--base-drawer-offset", `${sign * (1 - progress) * extent}px`);
	}

	#cancelFrame(): void {
		this.#frameCancel?.();
		this.#frameCancel = undefined;
	}

	#prepareOpen(): void {
		if (this.#snapPoint === 0) {
			this.snapTo(this.#snapPoints.at(-1) ?? 1);
		}
	}

	#requireDialog(): HTMLDialogElement {
		const dialog = this.#findDialog();
		if (dialog) {
			return dialog;
		}
		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception("DrawerElement requires a direct child <dialog>", "InvalidStateError");
	}

	#onCancel = (event: Event): void => {
		if (event.target !== this.#findDialog()) {
			return;
		}
		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		const forwarded = new EventConstructor("cancel", { cancelable: true });
		if (!this.dispatchEvent(forwarded)) {
			event.preventDefault();
		}
	};

	#onClose = (event: Event): void => {
		const dialog = this.#findDialog();
		if (event.target !== dialog) {
			return;
		}
		const pending = this.#pendingCloses.shift();
		if (!dialog.open && (!pending || this.#revision === pending.drag.revision)) {
			this.snapTo(0);
		}
		const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
		this.dispatchEvent(new EventConstructor("close"));
		if (pending && this.#snapPoint === 0 && !dialog.open && this.#isCurrentGesture(pending.drag)) {
			const CustomEventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
			this.dispatchEvent(
				new CustomEventConstructor<DrawerSnapDetail>("snapchange", {
					bubbles: true,
					composed: true,
					detail: pending.detail,
				}),
			);
		}
	};
}
