import type { PointerState } from "@serve-tools/client-input";
import { observePointer } from "@serve-tools/client-input";
import { AUIElement } from "./aui-element.js";

export interface ScrollAreaMetrics {
	readonly block: number;
	readonly clientHeight: number;
	readonly clientWidth: number;
	readonly inline: number;
	readonly maxBlock: number;
	readonly maxInline: number;
	readonly scrollHeight: number;
	readonly scrollWidth: number;
}

type Axis = "x" | "y";

interface DragGeometry {
	axis: Axis;
	document: Document;
	logical: number;
	maximum: number;
	rail: HTMLElement;
	rtl: boolean;
	signal: AbortSignal;
	thumb: HTMLElement;
	travel: number;
	viewport: HTMLElement;
}

interface RailStyle {
	authorOffset: string;
	authorOffsetPriority: string;
	authorSize: string;
	authorSizePriority: string;
	writtenOffset: string;
	writtenOffsetPriority: string;
	writtenSize: string;
	writtenSizePriority: string;
}

interface OwnedStyle {
	authorPriority: string;
	authorValue: string;
	writtenPriority: string;
	writtenValue: string;
}

const emptyMetrics: ScrollAreaMetrics = Object.freeze({
	block: 0,
	clientHeight: 0,
	clientWidth: 0,
	inline: 0,
	maxBlock: 0,
	maxInline: 0,
	scrollHeight: 0,
	scrollWidth: 0,
});
const rtlPositive = new WeakMap<Document, boolean>();
const htmlNamespace = "http://www.w3.org/1999/xhtml";
const potentiallyFocusableSelector =
	"a[href], area[href], audio[controls], button, iframe, input, select, summary, textarea, video[controls], [contenteditable], [tabindex]";

/** Measures and decorates one native authored scroll viewport without replacing its scrolling behavior. */
export class ScrollAreaElement extends AUIElement {
	#cleanups: (() => void)[] = [];
	#content: HTMLElement | undefined;
	#drag: DragGeometry | undefined;
	#frameCancel: (() => void) | undefined;
	#internals = this.attachInternals();
	#metrics: ScrollAreaMetrics = emptyMetrics;
	#rails = new Map<Axis, HTMLElement>();
	#railStyles = new Map<HTMLElement, RailStyle>();
	#resizeObserver: ResizeObserver | undefined;
	#signal: AbortSignal | undefined;
	#thumbs = new Map<Axis, HTMLElement>();
	#viewport: HTMLElement | undefined;

	get viewport(): HTMLElement | null {
		return this.#findViewport() ?? null;
	}

	get metrics(): ScrollAreaMetrics {
		if (this.#signal && this.#findViewport() !== this.#viewport) {
			this.#reconcile();
		} else if (!this.#signal && this.#viewport) {
			this.#releaseParts();
		}
		this.#measure();
		return this.#metrics;
	}

	scrollTo(options: ScrollToOptions): void;
	scrollTo(x: number, y: number): void;
	scrollTo(optionsOrX: number | ScrollToOptions, y?: number): void {
		const viewport = this.#requireViewport();
		if (typeof optionsOrX === "number") {
			viewport.scrollTo(optionsOrX, y ?? 0);
		} else {
			viewport.scrollTo(optionsOrX);
		}
	}

	scrollBy(options: ScrollToOptions): void;
	scrollBy(x: number, y: number): void;
	scrollBy(optionsOrX: number | ScrollToOptions, y?: number): void {
		const viewport = this.#requireViewport();
		if (typeof optionsOrX === "number") {
			viewport.scrollBy(optionsOrX, y ?? 0);
		} else {
			viewport.scrollBy(optionsOrX);
		}
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#signal = connection.signal;
		const view = this.ownerDocument.defaultView;
		const Observer = view?.MutationObserver ?? MutationObserver;
		const Resize = view?.ResizeObserver ?? ResizeObserver;
		const observer = new Observer(() => this.#reconcile());
		const resizeObserver = new Resize(() => this.#schedule());
		this.#resizeObserver = resizeObserver;
		connection.addCleanup(() => {
			observer.disconnect();
			resizeObserver.disconnect();
			this.#releaseParts();
			this.#cancelFrame();
			this.#signal = undefined;
		});
		observer.observe(this, {
			attributeFilter: ["contenteditable", "controls", "dir", "href", "slot", "tabindex"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		this.#reconcile();
	}

	protected override moved(): void {
		this.#schedule();
	}

	#findViewport(): HTMLElement | undefined {
		const matches = [...this.children].filter(
			(child): child is HTMLElement =>
				child.namespaceURI === htmlNamespace && (child as HTMLElement).slot === "viewport",
		);
		return matches.length === 1 ? matches[0] : undefined;
	}

	#findDirect(parent: Element, slot: string): HTMLElement | undefined {
		const matches = [...parent.children].filter(
			(child): child is HTMLElement =>
				child.namespaceURI === htmlNamespace && (child as HTMLElement).slot === slot,
		);
		return matches.length === 1 ? matches[0] : undefined;
	}

	#reconcile(): void {
		const viewport = this.#findViewport();
		const content = viewport ? this.#findDirect(viewport, "content") : undefined;
		const candidateRailX = this.#findDirect(this, "scrollbar-x");
		const candidateRailY = this.#findDirect(this, "scrollbar-y");
		const railX = candidateRailX && this.#isPresentational(candidateRailX) ? candidateRailX : undefined;
		const railY = candidateRailY && this.#isPresentational(candidateRailY) ? candidateRailY : undefined;
		const thumbX = railX ? this.#findDirect(railX, "thumb-x") : undefined;
		const thumbY = railY ? this.#findDirect(railY, "thumb-y") : undefined;
		if (
			viewport === this.#viewport &&
			content === this.#content &&
			railX === this.#rails.get("x") &&
			railY === this.#rails.get("y") &&
			thumbX === this.#thumbs.get("x") &&
			thumbY === this.#thumbs.get("y")
		) {
			this.#schedule();
			return;
		}

		this.#releaseParts();
		this.#viewport = viewport;
		this.#content = content;
		if (railX) {
			this.#rails.set("x", railX);
		}
		if (railY) {
			this.#rails.set("y", railY);
		}
		if (thumbX) {
			this.#thumbs.set("x", thumbX);
		}
		if (thumbY) {
			this.#thumbs.set("y", thumbY);
		}
		if (!this.#signal || this.#signal.aborted) {
			return;
		}

		if (viewport) {
			viewport.addEventListener("scroll", this.#schedule, { passive: true });
			this.#cleanups.push(() => viewport.removeEventListener("scroll", this.#schedule));
			this.#resizeObserver?.observe(viewport);
		}
		if (content) {
			this.#resizeObserver?.observe(content);
		}
		for (const [axis, rail] of this.#rails) {
			const size = rail.style.getPropertyValue("--aui-scroll-thumb-size");
			const offset = rail.style.getPropertyValue("--aui-scroll-thumb-offset");
			const railStyle: RailStyle = {
				authorOffset: offset,
				authorOffsetPriority: rail.style.getPropertyPriority("--aui-scroll-thumb-offset"),
				authorSize: size,
				authorSizePriority: rail.style.getPropertyPriority("--aui-scroll-thumb-size"),
				writtenOffset: offset,
				writtenOffsetPriority: rail.style.getPropertyPriority("--aui-scroll-thumb-offset"),
				writtenSize: size,
				writtenSizePriority: rail.style.getPropertyPriority("--aui-scroll-thumb-size"),
			};
			this.#railStyles.set(rail, railStyle);
			let authorAriaHidden = rail.getAttribute("aria-hidden");
			rail.setAttribute("aria-hidden", "true");
			this.#cleanups.push(() => {
				if (rail.getAttribute("aria-hidden") !== "true") {
					return;
				}
				if (authorAriaHidden === null) {
					rail.removeAttribute("aria-hidden");
				} else {
					rail.setAttribute("aria-hidden", authorAriaHidden);
				}
			});
			this.#resizeObserver?.observe(rail);
			const thumb = this.#thumbs.get(axis);
			const touchAction = thumb ? ownedStyle(thumb, "touch-action") : undefined;
			if (thumb && touchAction) {
				writeOwnedStyle(thumb, "touch-action", touchAction, "none");
				this.#cleanups.push(() => restoreOwnedStyle(thumb, "touch-action", touchAction));
			}
			const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
			const ownershipObserver = new Observer(() => {
				const ariaHidden = rail.getAttribute("aria-hidden");
				if (ariaHidden !== "true") {
					authorAriaHidden = ariaHidden;
					rail.setAttribute("aria-hidden", "true");
				}
				this.#maintainRailStyle(rail, railStyle);
				if (thumb && touchAction) {
					writeOwnedStyle(thumb, "touch-action", touchAction, "none");
				}
			});
			ownershipObserver.observe(rail, { attributeFilter: ["aria-hidden", "style"], attributes: true });
			if (thumb) {
				ownershipObserver.observe(thumb, { attributeFilter: ["style"], attributes: true });
			}
			this.#cleanups.push(() => ownershipObserver.disconnect());
			if (!thumb) {
				continue;
			}
			this.#cleanups.push(
				observePointer(
					thumb,
					{
						start: (state, event) => this.#startDrag(axis, state, event),
						move: (state) => this.#moveDrag(state),
						end: () => (this.#drag = undefined),
					},
					{ signal: this.#signal },
				),
			);
		}
		this.#schedule();
	}

	#releaseParts(): void {
		for (let index = this.#cleanups.length - 1; index >= 0; --index) {
			this.#cleanups[index]();
		}
		this.#cleanups = [];
		for (const [rail, style] of this.#railStyles) {
			this.#restoreRailStyle(rail, style);
		}
		this.#railStyles.clear();
		this.#resizeObserver?.disconnect();
		this.#viewport = undefined;
		this.#content = undefined;
		this.#rails.clear();
		this.#thumbs.clear();
		this.#drag = undefined;
	}

	#schedule = (): void => {
		if (this.#frameCancel || !this.#signal || this.#signal.aborted) {
			return;
		}
		const view = this.ownerDocument.defaultView;
		const request = view?.requestAnimationFrame.bind(view) ?? requestAnimationFrame;
		const cancel = view?.cancelAnimationFrame.bind(view) ?? cancelAnimationFrame;
		const frame = request(() => {
			this.#frameCancel = undefined;
			this.#measure();
		});
		this.#frameCancel = () => cancel(frame);
	};

	#measure(): void {
		const viewport = this.#viewport ?? this.#findViewport();
		if (!viewport) {
			this.#metrics = emptyMetrics;
			this.#states(false, false, true, true, true, true);
			return;
		}
		const maxInline = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
		const maxBlock = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
		const inline = this.#logicalInline(viewport, maxInline);
		const block = Math.min(maxBlock, Math.max(0, viewport.scrollTop));
		this.#metrics = Object.freeze({
			block,
			clientHeight: viewport.clientHeight,
			clientWidth: viewport.clientWidth,
			inline,
			maxBlock,
			maxInline,
			scrollHeight: viewport.scrollHeight,
			scrollWidth: viewport.scrollWidth,
		});
		this.style.setProperty("--aui-scroll-inline", `${inline}px`);
		this.style.setProperty("--aui-scroll-block", `${block}px`);
		this.style.setProperty("--aui-scroll-max-inline", `${maxInline}px`);
		this.style.setProperty("--aui-scroll-max-block", `${maxBlock}px`);
		this.#writeRail("x", inline, maxInline, viewport.clientWidth, viewport.scrollWidth);
		this.#writeRail("y", block, maxBlock, viewport.clientHeight, viewport.scrollHeight);
		this.#states(maxInline > 0, maxBlock > 0, inline <= 0, inline >= maxInline, block <= 0, block >= maxBlock);
	}

	#writeRail(axis: Axis, position: number, maximum: number, client: number, scroll: number): void {
		const rail = this.#rails.get(axis);
		const thumb = this.#thumbs.get(axis);
		if (!rail || !thumb) {
			return;
		}
		const extent = axis === "x" ? rail.clientWidth : rail.clientHeight;
		const size = scroll > 0 ? Math.min(extent, (client / scroll) * extent) : extent;
		const offset = maximum > 0 ? (position / maximum) * Math.max(0, extent - size) : 0;
		const style = this.#railStyles.get(rail);
		if (!style) {
			return;
		}
		this.#writeRailStyle(rail, style, "size", `${size}px`);
		this.#writeRailStyle(rail, style, "offset", `${offset}px`);
	}

	#writeRailStyle(rail: HTMLElement, style: RailStyle, kind: "offset" | "size", value: string): void {
		const property = kind === "offset" ? "--aui-scroll-thumb-offset" : "--aui-scroll-thumb-size";
		const written = kind === "offset" ? style.writtenOffset : style.writtenSize;
		const writtenPriority = kind === "offset" ? style.writtenOffsetPriority : style.writtenSizePriority;
		const current = rail.style.getPropertyValue(property);
		const currentPriority = rail.style.getPropertyPriority(property);
		if (current !== written || currentPriority !== writtenPriority) {
			if (kind === "offset") {
				style.authorOffset = current;
				style.authorOffsetPriority = currentPriority;
			} else {
				style.authorSize = current;
				style.authorSizePriority = currentPriority;
			}
		}
		if (current !== value || currentPriority !== "") {
			if (currentPriority !== "") {
				rail.style.removeProperty(property);
			}
			rail.style.setProperty(property, value, "");
		}
		if (kind === "offset") {
			style.writtenOffset = value;
			style.writtenOffsetPriority = "";
		} else {
			style.writtenSize = value;
			style.writtenSizePriority = "";
		}
	}

	#maintainRailStyle(rail: HTMLElement, style: RailStyle): void {
		this.#writeRailStyle(rail, style, "offset", style.writtenOffset);
		this.#writeRailStyle(rail, style, "size", style.writtenSize);
	}

	#restoreRailStyle(rail: HTMLElement, style: RailStyle): void {
		for (const [property, written, writtenPriority, author, authorPriority] of [
			[
				"--aui-scroll-thumb-offset",
				style.writtenOffset,
				style.writtenOffsetPriority,
				style.authorOffset,
				style.authorOffsetPriority,
			],
			[
				"--aui-scroll-thumb-size",
				style.writtenSize,
				style.writtenSizePriority,
				style.authorSize,
				style.authorSizePriority,
			],
		] as const) {
			if (
				rail.style.getPropertyValue(property) !== written ||
				rail.style.getPropertyPriority(property) !== writtenPriority
			) {
				continue;
			}
			if (author === "") {
				rail.style.removeProperty(property);
			} else {
				rail.style.setProperty(property, author, authorPriority);
			}
		}
	}

	#states(
		overflowX: boolean,
		overflowY: boolean,
		inlineStart: boolean,
		inlineEnd: boolean,
		blockStart: boolean,
		blockEnd: boolean,
	): void {
		for (const [name, present] of [
			["overflow-x", overflowX],
			["overflow-y", overflowY],
			["inline-start", inlineStart],
			["inline-end", inlineEnd],
			["block-start", blockStart],
			["block-end", blockEnd],
		] as const) {
			if (present) {
				this.#internals.states.add(name);
			} else {
				this.#internals.states.delete(name);
			}
		}
	}

	#startDrag(axis: Axis, _state: PointerState, event: PointerEvent): boolean {
		const viewport = this.#findViewport();
		const rail = this.#findDirect(this, `scrollbar-${axis}`);
		const thumb = rail ? this.#findDirect(rail, `thumb-${axis}`) : undefined;
		const signal = this.#signal;
		const style = viewport ? this.#style(viewport) : undefined;
		if (
			event.defaultPrevented ||
			!viewport ||
			!rail ||
			!thumb ||
			viewport !== this.#viewport ||
			rail !== this.#rails.get(axis) ||
			thumb !== this.#thumbs.get(axis) ||
			!this.#isPresentational(rail) ||
			!signal ||
			signal.aborted ||
			style?.writingMode !== "horizontal-tb" ||
			!event.isPrimary ||
			event.button !== 0
		) {
			return false;
		}
		event.preventDefault();
		this.#measure();
		const maximum = axis === "x" ? this.#metrics.maxInline : this.#metrics.maxBlock;
		const logical = axis === "x" ? this.#metrics.inline : this.#metrics.block;
		const travel = Math.max(
			1,
			axis === "x" ? rail.clientWidth - thumb.offsetWidth : rail.clientHeight - thumb.offsetHeight,
		);
		this.#drag = {
			axis,
			document: this.ownerDocument,
			logical,
			maximum,
			rail,
			rtl: style.direction === "rtl",
			signal,
			thumb,
			travel,
			viewport,
		};
		return true;
	}

	#moveDrag(state: PointerState): void {
		const drag = this.#drag;
		if (!drag || !this.#isCurrentDrag(drag)) {
			this.#drag = undefined;
			return;
		}
		const { viewport } = drag;
		let delta = drag.axis === "x" ? state.delta.x : state.delta.y;
		if (drag.axis === "x" && drag.rtl) {
			delta = -delta;
		}
		const logical = Math.min(drag.maximum, Math.max(0, drag.logical + (delta / drag.travel) * drag.maximum));
		if (drag.axis === "y") {
			viewport.scrollTop = logical;
		} else {
			this.#setLogicalInline(viewport, logical, drag.maximum);
		}
	}

	#isCurrentDrag(drag: DragGeometry): boolean {
		return (
			!drag.signal.aborted &&
			this.#signal === drag.signal &&
			this.ownerDocument === drag.document &&
			this.#findViewport() === drag.viewport &&
			this.#findDirect(this, `scrollbar-${drag.axis}`) === drag.rail &&
			this.#findDirect(drag.rail, `thumb-${drag.axis}`) === drag.thumb &&
			this.#isPresentational(drag.rail) &&
			this.#style(drag.viewport).writingMode === "horizontal-tb" &&
			this.#isRTL(drag.viewport) === drag.rtl
		);
	}

	#logicalInline(viewport: HTMLElement, maximum: number): number {
		if (!this.#isRTL(viewport)) {
			return Math.min(maximum, Math.max(0, viewport.scrollLeft));
		}
		return rtlPositiveFor(this.ownerDocument) ? maximum - viewport.scrollLeft : -viewport.scrollLeft;
	}

	#setLogicalInline(viewport: HTMLElement, logical: number, maximum: number): void {
		viewport.scrollLeft =
			this.#isRTL(viewport) && rtlPositiveFor(this.ownerDocument)
				? maximum - logical
				: this.#isRTL(viewport)
					? -logical
					: logical;
	}

	#isRTL(viewport: HTMLElement): boolean {
		return this.#style(viewport).direction === "rtl";
	}

	#style(element: Element): CSSStyleDeclaration {
		return this.ownerDocument.defaultView?.getComputedStyle(element) ?? getComputedStyle(element);
	}

	#isPresentational(rail: HTMLElement): boolean {
		return !rail.matches(potentiallyFocusableSelector) && !rail.querySelector(potentiallyFocusableSelector);
	}

	#requireViewport(): HTMLElement {
		const viewport = this.#findViewport();
		if (viewport) {
			return viewport;
		}
		const Exception = this.ownerDocument.defaultView?.DOMException ?? DOMException;
		throw new Exception("ScrollAreaElement requires one direct slot=viewport element", "InvalidStateError");
	}

	#cancelFrame(): void {
		this.#frameCancel?.();
		this.#frameCancel = undefined;
	}
}

const rtlPositiveFor = (document: Document): boolean => {
	const cached = rtlPositive.get(document);
	if (cached !== undefined) {
		return cached;
	}
	const outer = document.createElement("div");
	const inner = document.createElement("div");
	outer.dir = "rtl";
	outer.style.cssText = "position:absolute;left:-9999px;width:4px;overflow:scroll";
	inner.style.width = "8px";
	outer.append(inner);
	(document.body ?? document.documentElement).append(outer);
	const positive = outer.scrollLeft > 0;
	outer.remove();
	rtlPositive.set(document, positive);
	return positive;
};

const ownedStyle = (element: HTMLElement, property: string): OwnedStyle => ({
	authorPriority: element.style.getPropertyPriority(property),
	authorValue: element.style.getPropertyValue(property),
	writtenPriority: element.style.getPropertyPriority(property),
	writtenValue: element.style.getPropertyValue(property),
});

const writeOwnedStyle = (element: HTMLElement, property: string, style: OwnedStyle, value: string): void => {
	const currentValue = element.style.getPropertyValue(property);
	const currentPriority = element.style.getPropertyPriority(property);
	if (currentValue !== style.writtenValue || currentPriority !== style.writtenPriority) {
		style.authorValue = currentValue;
		style.authorPriority = currentPriority;
	}
	if (currentValue !== value || currentPriority !== "") {
		if (currentPriority !== "") {
			element.style.removeProperty(property);
		}
		element.style.setProperty(property, value, "");
	}
	style.writtenValue = value;
	style.writtenPriority = "";
};

const restoreOwnedStyle = (element: HTMLElement, property: string, style: OwnedStyle): void => {
	if (
		element.style.getPropertyValue(property) !== style.writtenValue ||
		element.style.getPropertyPriority(property) !== style.writtenPriority
	) {
		return;
	}
	if (style.authorValue === "") {
		element.style.removeProperty(property);
	} else {
		element.style.setProperty(property, style.authorValue, style.authorPriority);
	}
};
