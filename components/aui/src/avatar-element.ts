import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";

/** The current outcome of an avatar image request. */
export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

/** Displays a native avatar image or retained author fallback content. */
export class AvatarElement extends AUIElement {
	static readonly observedAttributes = ["alt", "delay", "src"];

	#connectionSignal: AbortSignal | undefined;
	#fallback = this.ownerDocument.createElement("span");
	#fallbackReady = true;
	#image = this.ownerDocument.createElement("img");
	#internals = this.attachInternals();
	#requestController: AbortController | undefined;
	#requestDocument: Document | undefined;
	#requestGeneration = 0;
	#requestSource: string | null = null;
	#status: AvatarStatus = "idle";
	#timerCleanup: (() => void) | undefined;

	constructor() {
		super();

		this.#image.setAttribute("part", "image");
		this.#fallback.setAttribute("part", "fallback");
		this.#fallback.append(this.ownerDocument.createElement("slot"));

		for (const property of ["alt", "delay", "src"] as const) {
			upgradeProperty(this, property);
		}

		this.#synchronizeAlt();
		this.#synchronizeVisibility();
	}

	/** The image URL, or the empty string when no image is requested. */
	get src(): string {
		return this.getAttribute("src") ?? "";
	}

	set src(value: string) {
		this.setAttribute("src", String(value));
	}

	/** The native image text alternative. The empty string makes the image decorative. */
	get alt(): string {
		return this.getAttribute("alt") ?? "";
	}

	set alt(value: string) {
		this.setAttribute("alt", String(value));
	}

	/** Milliseconds to wait before revealing fallback content while an image request is pending. */
	get delay(): number {
		const value = Number(this.getAttribute("delay"));
		return Number.isFinite(value) && value > 0 ? value : 0;
	}

	set delay(value: number) {
		const number = Number(value);
		this.setAttribute("delay", String(Number.isFinite(number) && number > 0 ? number : 0));
	}

	/** The native image retained for inspection and styling. Set `src` on the host rather than mutating this image. */
	get image(): HTMLImageElement {
		return this.#image;
	}

	/** The current image request status. */
	get status(): AvatarStatus {
		return this.#status;
	}

	attributeChangedCallback(name: string): void {
		if (name === "alt") {
			this.#synchronizeAlt();
		} else if (name === "delay") {
			if (this.#connectionSignal && !this.#connectionSignal.aborted) {
				this.#restartFallbackDelay();
			} else {
				this.#clearTimer();
				if (this.#status === "error") {
					this.#fallbackReady = true;
					this.#synchronizeVisibility();
				}
			}
		} else if (this.#connectionSignal && !this.#connectionSignal.aborted) {
			this.#startRequest();
		} else {
			this.#cancelRequest();
			this.#requestSource = null;
			this.#setStatus("idle");
		}
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout(content: DocumentFragment): void {
		content.append(this.#image, this.#fallback);
	}

	protected override connect(connection: AUIElement.Connection): void {
		this.#connectionSignal = connection.signal;
		const source = this.getAttribute("src");
		if (this.#requestDocument !== this.ownerDocument || this.#requestSource !== source || this.#status === "idle") {
			this.#startRequest();
		}

		connection.addCleanup(() => {
			if (this.#connectionSignal !== connection.signal) {
				return;
			}

			this.#connectionSignal = undefined;
			this.#clearTimer();
			if (this.#status === "loading") {
				this.#cancelRequest();
				this.#image.removeAttribute("src");
				this.#setStatus("idle");
			} else if (this.#status === "error") {
				this.#fallbackReady = true;
				this.#synchronizeVisibility();
			}
		});
	}

	#startRequest(): void {
		this.#cancelRequest();
		const generation = ++this.#requestGeneration;
		const source = this.getAttribute("src");
		this.#requestDocument = this.ownerDocument;
		this.#requestSource = source;

		if (!source) {
			this.#image.removeAttribute("src");
			this.#fallbackReady = true;
			this.#setStatus("idle");
			return;
		}

		const Controller = this.ownerDocument.defaultView?.AbortController ?? AbortController;
		const controller = new Controller();
		this.#requestController = controller;
		this.#fallbackReady = this.delay === 0;
		this.#setStatus("loading");

		this.#image.addEventListener(
			"load",
			() => {
				if (
					generation === this.#requestGeneration &&
					this.getAttribute("src") === source &&
					this.#image.getAttribute("src") === source &&
					this.#image.complete &&
					this.#image.naturalWidth > 0
				) {
					this.#finishRequest("loaded");
				}
			},
			{ signal: controller.signal },
		);
		this.#image.addEventListener(
			"error",
			() => {
				if (
					generation === this.#requestGeneration &&
					this.getAttribute("src") === source &&
					this.#image.getAttribute("src") === source &&
					this.#image.complete &&
					this.#image.naturalWidth === 0
				) {
					this.#finishRequest("error");
				}
			},
			{ signal: controller.signal },
		);

		this.#restartFallbackDelay();
		this.#image.setAttribute("src", source);
	}

	#finishRequest(status: "loaded" | "error"): void {
		this.#requestController?.abort();
		this.#requestController = undefined;

		if (status === "loaded") {
			this.#clearTimer();
		}
		this.#setStatus(status);
	}

	#restartFallbackDelay(): void {
		this.#clearTimer();
		if (this.#status !== "loading" && this.#status !== "error") {
			return;
		}

		const delay = this.delay;
		if (delay === 0) {
			this.#fallbackReady = true;
			this.#synchronizeVisibility();
			return;
		}

		this.#fallbackReady = false;
		this.#synchronizeVisibility();
		const generation = this.#requestGeneration;
		const window = this.ownerDocument.defaultView;
		const set = window?.setTimeout.bind(window) ?? setTimeout;
		const clear = window?.clearTimeout.bind(window) ?? clearTimeout;
		const timer = set(() => {
			this.#timerCleanup = undefined;
			if (generation !== this.#requestGeneration || this.#status === "loaded") {
				return;
			}

			this.#fallbackReady = true;
			this.#synchronizeVisibility();
		}, delay);
		this.#timerCleanup = () => clear(timer);
	}

	#cancelRequest(): void {
		++this.#requestGeneration;
		this.#requestController?.abort();
		this.#requestController = undefined;
		this.#clearTimer();
	}

	#clearTimer(): void {
		this.#timerCleanup?.();
		this.#timerCleanup = undefined;
	}

	#setStatus(status: AvatarStatus): void {
		this.#status = status;
		for (const candidate of ["idle", "loading", "loaded", "error"] as const) {
			if (candidate === status) {
				this.#internals.states.add(candidate);
			} else {
				this.#internals.states.delete(candidate);
			}
		}
		this.#synchronizeVisibility();
	}

	#synchronizeAlt(): void {
		this.#image.alt = this.alt;
	}

	#synchronizeVisibility(): void {
		this.#image.hidden = this.#status !== "loaded";
		this.#fallback.hidden = this.#status === "loaded" || (!!this.getAttribute("src") && !this.#fallbackReady);
		if (this.#fallback.hidden) {
			this.#internals.states.delete("fallback");
		} else {
			this.#internals.states.add("fallback");
		}
	}
}
