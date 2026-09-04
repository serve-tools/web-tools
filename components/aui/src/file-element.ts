import { observeDropTarget } from "@serve-tools/client-input";
import { upgradeProperty } from "./.upgrade.js";
import { AUIElement } from "./aui-element.js";

/** A proposed dropped file batch. */
export interface FileChangeDetail {
	readonly files: readonly File[];
	readonly sourceEvent: DragEvent;
}

/** Events emitted by a file wrapper. */
export interface FileEventMap extends HTMLElementEventMap {
	beforechange: CustomEvent<FileChangeDetail>;
}

const htmlNamespace = "http://www.w3.org/1999/xhtml";
const constraintMessage = "Selected files do not meet this file input's configured constraints.";

/** Enhances one authored native file input without becoming a second form, label, focus, or picker identity. */
export class FileElement extends AUIElement {
	static readonly observedAttributes = ["max-size"];

	#authorValidity: string | undefined;
	#connectionEpoch = 0;
	#connectionSignal: AbortSignal | undefined;
	#constructing = true;
	#dropping = false;
	#input: HTMLInputElement | undefined;
	#observer: MutationObserver | undefined;
	#ownValidity = false;
	#resetRoot: EventTarget | undefined;
	#revision = 0;
	#snapshot: readonly File[] = Object.freeze([]);

	declare addEventListener: {
		<Type extends keyof FileEventMap>(
			type: Type,
			listener: (this: FileElement, event: FileEventMap[Type]) => unknown,
			options?: boolean | AddEventListenerOptions,
		): void;
		(
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: boolean | AddEventListenerOptions,
		): void;
	};

	declare removeEventListener: {
		<Type extends keyof FileEventMap>(
			type: Type,
			listener: (this: FileElement, event: FileEventMap[Type]) => unknown,
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
		try {
			for (const property of ["maxSize", "files"] as const) {
				upgradeProperty(this, property);
			}
		} finally {
			this.#constructing = false;
		}
		this.#refresh();
	}

	/** The sole direct authored native file input, or null until exactly one exists. */
	get input(): HTMLInputElement | null {
		this.#refresh();
		return this.#input ?? null;
	}

	/** A frozen snapshot of the native input's current files. */
	get files(): readonly File[] {
		this.#refresh();
		return this.#snapshot;
	}

	/** Replaces the native input's files silently through a native DataTransfer transaction. */
	set files(files: readonly File[]) {
		this.#assign(files, false);
	}

	/** Maximum accepted file size in bytes, or undefined when size is unconstrained. */
	get maxSize(): number | undefined {
		const value = this.getAttribute("max-size");
		return value === null ? undefined : parseMaxSize(value);
	}

	set maxSize(value: number | undefined) {
		if (value === undefined) {
			this.removeAttribute("max-size");
			return;
		}
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new TypeError("File maxSize must be a nonnegative safe integer");
		}
		this.setAttribute("max-size", String(value));
	}

	/** Opens the browser's native file picker through the authored input. */
	pick(): void {
		this.#requireInput().click();
	}

	/** Reconciles silent native property and validity changes. */
	refresh(): void {
		this.#refresh();
	}

	attributeChangedCallback(): void {
		if (this.#constructing) {
			return;
		}
		++this.#revision;
		this.#validate();
	}

	protected override connect(connection: AUIElement.Connection): void {
		const epoch = ++this.#connectionEpoch;
		this.#connectionSignal = connection.signal;
		const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
		const observer = new Observer(() => {
			this.#refresh();
		});
		this.#observer = observer;
		observer.observe(this, {
			attributes: true,
			attributeFilter: ["accept", "disabled", "form", "max-size", "multiple", "slot", "type"],
			childList: true,
			subtree: true,
		});
		this.addEventListener("input", this.#onNativeChange, { capture: true, signal: connection.signal });
		this.addEventListener("change", this.#onNativeChange, { capture: true, signal: connection.signal });
		this.#observeResetRoot(connection);
		observeDropTarget(
			this,
			{
				over: (event) => {
					if (event.dataTransfer?.files.length) {
						event.preventDefault();
					}
				},
				end: (state, event) => {
					if (state.reason === "drop" && event) {
						this.#drop(event);
					}
				},
			},
			{ signal: connection.signal },
		);
		connection.addCleanup(() => {
			observer.disconnect();
			this.#releaseResetRoot();
			if (this.#observer === observer) {
				this.#observer = undefined;
			}
			if (this.#connectionEpoch === epoch) {
				++this.#connectionEpoch;
				this.#connectionSignal = undefined;
			}
		});
		this.#refresh();
	}

	protected override moved(connection: AUIElement.Connection): void {
		this.#observeResetRoot(connection);
	}

	#onNativeChange = (event: Event): void => {
		if (event.composedPath().includes(this.#input!)) {
			this.#refresh();
		}
	};

	#onReset = (event: Event): void => {
		const form = event.target;
		const input = this.#input;
		const epoch = this.#connectionEpoch;
		const signal = this.#connectionSignal;
		if (!input || input.form !== form) {
			return;
		}
		queueMicrotask(() => {
			if (
				!event.defaultPrevented &&
				!signal?.aborted &&
				epoch === this.#connectionEpoch &&
				input === this.#input &&
				input.form === form
			) {
				this.#refresh();
			}
		});
	};

	#drop(event: DragEvent): void {
		if (this.#dropping) {
			return;
		}
		const files = Object.freeze([...(event.dataTransfer?.files ?? [])]);
		if (!files.length) {
			return;
		}
		event.preventDefault();
		const input = this.#input;
		const initialFiles = Object.freeze([...(input?.files ?? [])]);
		const epoch = this.#connectionEpoch;
		if (!input || input.matches(":disabled") || !this.#valid(files, true)) {
			return;
		}
		const revision = ++this.#revision;
		const EventConstructor = this.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
		const proposal = new EventConstructor<FileChangeDetail>("beforechange", {
			bubbles: true,
			cancelable: true,
			composed: true,
			detail: Object.freeze({ files, sourceEvent: event }),
		});
		this.#dropping = true;
		try {
			if (
				!this.dispatchEvent(proposal) ||
				revision !== this.#revision ||
				!this.isConnected ||
				epoch !== this.#connectionEpoch ||
				input !== this.#input ||
				input !== this.#findInput() ||
				input.matches(":disabled") ||
				!sameFiles(initialFiles, input.files ?? [])
			) {
				return;
			}
			this.#assign(files, true, epoch);
		} finally {
			this.#dropping = false;
		}
	}

	#assign(files: readonly File[], emit: boolean, epoch = this.#connectionEpoch): void {
		const accepted = Object.freeze([...files]);
		for (const file of accepted) {
			if (!isFile(file)) {
				throw new TypeError("File files must contain File objects");
			}
		}
		const input = this.#requireInput();
		++this.#revision;
		if (!this.#valid(accepted, true)) {
			return;
		}
		const Transfer = input.ownerDocument.defaultView?.DataTransfer ?? DataTransfer;
		const transfer = new Transfer();
		for (const file of accepted) {
			transfer.items.add(file);
		}
		input.files = transfer.files;
		this.#refresh();
		if (emit) {
			const committed = this.#revision;
			const EventConstructor = input.ownerDocument.defaultView?.Event ?? Event;
			input.dispatchEvent(new EventConstructor("input", { bubbles: true, composed: true }));
			this.#refresh();
			if (
				committed !== this.#revision ||
				epoch !== this.#connectionEpoch ||
				input !== this.#input ||
				input !== this.#findInput() ||
				!sameFiles(accepted, input.files ?? [])
			) {
				return;
			}
			input.dispatchEvent(new EventConstructor("change", { bubbles: true }));
		}
	}

	#refresh(): void {
		const input = this.#findInput();
		if (input !== this.#input) {
			this.#restoreValidity();
			this.#input = input;
			this.#authorValidity = undefined;
			this.#ownValidity = false;
		}
		this.#snapshot = Object.freeze([...(input?.files ?? [])]);
		this.#validate();
	}

	#validate(): void {
		if (this.#constructing) {
			return;
		}
		const input = this.#input;
		if (!input) {
			return;
		}
		if (this.#ownValidity && input.validationMessage !== constraintMessage) {
			this.#authorValidity = input.validationMessage;
			this.#ownValidity = false;
		}
		const invalid = !this.#valid(this.#snapshot, false);
		if (invalid) {
			if (!this.#ownValidity) {
				this.#authorValidity = input.validationMessage;
			}
			input.setCustomValidity(constraintMessage);
			this.#ownValidity = true;
		} else if (this.#ownValidity) {
			input.setCustomValidity(this.#authorValidity ?? "");
			this.#ownValidity = false;
			this.#authorValidity = undefined;
		}
	}

	#restoreValidity(): void {
		if (this.#input && this.#ownValidity && this.#input.validationMessage === constraintMessage) {
			this.#input.setCustomValidity(this.#authorValidity ?? "");
		}
	}

	#valid(files: readonly File[], applyAccept: boolean): boolean {
		const input = this.#input;
		const maxSize = this.maxSize;
		return (
			(!input || input.multiple || files.length <= 1) &&
			(maxSize === undefined || files.every((file) => file.size <= maxSize)) &&
			(!applyAccept || !input || files.every((file) => accepts(input.accept, file)))
		);
	}

	#findInput(): HTMLInputElement | undefined {
		const inputs = [...this.children].filter(
			(child): child is HTMLInputElement =>
				child.namespaceURI === htmlNamespace &&
				child.localName === "input" &&
				(child as HTMLInputElement).type === "file",
		);
		return inputs.length === 1 ? inputs[0] : undefined;
	}

	#requireInput(): HTMLInputElement {
		this.#refresh();
		if (!this.#input) {
			throw new Error("File requires exactly one direct authored input[type=file]");
		}
		return this.#input;
	}

	#observeResetRoot(connection: AUIElement.Connection): void {
		const root = this.getRootNode();
		if (root === this.#resetRoot) {
			return;
		}
		this.#releaseResetRoot();
		this.#resetRoot = root;
		root.addEventListener("reset", this.#onReset, { capture: true, signal: connection.signal });
	}

	#releaseResetRoot(): void {
		this.#resetRoot?.removeEventListener("reset", this.#onReset, true);
		this.#resetRoot = undefined;
	}
}

const isFile = (value: unknown): value is File => {
	if (Object.prototype.toString.call(value) !== "[object File]") {
		return false;
	}
	try {
		const name = Object.getOwnPropertyDescriptor(File.prototype, "name")?.get;
		if (!name) {
			return false;
		}
		void name.call(value);
		return true;
	} catch {
		return false;
	}
};

const parseMaxSize = (value: string): number | undefined => {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const sameFiles = (left: readonly File[], right: Iterable<File>): boolean => {
	const values = [...right];
	return left.length === values.length && left.every((file, index) => file === values[index]);
};

const accepts = (accept: string, file: File): boolean => {
	const rules = accept
		.split(",")
		.map((rule) => rule.trim().toLowerCase())
		.filter(Boolean);
	if (!rules.length) {
		return true;
	}
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return rules.some((rule) =>
		rule.startsWith(".")
			? name.endsWith(rule)
			: rule.endsWith("/*")
				? type.startsWith(rule.slice(0, -1))
				: type === rule,
	);
};
