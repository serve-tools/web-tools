import { getContextConsumer, getContextProvider, isInvalidContext } from "./.internals.js";
import type { ContextCallback, UnknownContext } from "./context.js";
import { ContextRequestEvent } from "./context.js";

interface PendingRequest {
	readonly callbackRef: WeakRef<ContextCallback<unknown>>;
	readonly consumerRef: WeakRef<Element>;
	readonly context: UnknownContext;
	active: boolean;
}

interface PendingContext {
	readonly requests: Set<PendingRequest>;
}

const roots = new WeakMap<Document, ContextRoot>();

/** Retains unanswered subscriptions and replays them when a matching provider announces itself. */
export class ContextRoot {
	readonly #attachments = new Set<EventTarget>();
	readonly #pending = new Map<UnknownContext, PendingContext>();
	#pendingByConsumer = new WeakMap<Element, Map<UnknownContext, Map<ContextCallback<unknown>, PendingRequest>>>();

	constructor(root?: EventTarget) {
		if (root !== undefined) {
			this.attach(root);
		}
	}

	/** Observes unanswered requests and provider announcements at a DOM boundary. */
	attach(root: EventTarget): void {
		if (this.#attachments.has(root)) {
			return;
		}

		this.#attachments.add(root);

		root.addEventListener("context-request", this.#onContextRequest);
		root.addEventListener("context-provider", this.#onContextProvider);
	}

	/** Stops observing a DOM boundary without discarding requests retained through another attachment. */
	detach(root: EventTarget): void {
		if (!this.#attachments.delete(root)) {
			return;
		}

		root.removeEventListener("context-request", this.#onContextRequest);
		root.removeEventListener("context-provider", this.#onContextProvider);
	}

	/** Removes one retained request, if present. */
	cancel(context: UnknownContext, consumer: Element, callback: ContextCallback<unknown>): void {
		const request = this.#pendingByConsumer.get(consumer)?.get(context)?.get(callback);

		if (request !== undefined) {
			this.#remove(request);
		}
	}

	/** Discards all retained requests and removes every event listener owned by this root. */
	destroy(): void {
		for (const attachment of this.#attachments) {
			attachment.removeEventListener("context-request", this.#onContextRequest);
			attachment.removeEventListener("context-provider", this.#onContextProvider);
		}

		this.#attachments.clear();

		for (const pending of this.#pending.values()) {
			for (const request of pending.requests) {
				request.active = false;
			}
		}

		this.#pending.clear();
		this.#pendingByConsumer = new WeakMap();
	}

	readonly #onContextRequest: EventListener = (event): void => {
		const consumer = getContextConsumer(event);
		const request = event as Event & {
			readonly callback?: ContextCallback<unknown>;
			readonly context: UnknownContext;
			readonly subscribe?: unknown;
		};

		if (
			consumer === undefined ||
			!request.subscribe ||
			typeof request.callback !== "function" ||
			isInvalidContext(request.context)
		) {
			return;
		}

		let contexts = this.#pendingByConsumer.get(consumer);

		if (contexts === undefined) {
			contexts = new Map();

			this.#pendingByConsumer.set(consumer, contexts);
		}

		let callbacks = contexts.get(request.context);

		if (callbacks === undefined) {
			callbacks = new Map();

			contexts.set(request.context, callbacks);
		}

		if (callbacks.has(request.callback)) {
			return;
		}

		let pending = this.#pending.get(request.context);

		if (pending === undefined) {
			pending = { requests: new Set() };

			this.#pending.set(request.context, pending);
		}

		const pendingRequest: PendingRequest = {
			active: true,
			callbackRef: new WeakRef(request.callback),
			consumerRef: new WeakRef(consumer),
			context: request.context,
		};

		callbacks.set(request.callback, pendingRequest);
		pending.requests.add(pendingRequest);
	};

	readonly #onContextProvider: EventListener = (event): void => {
		if (getContextProvider(event) === undefined) {
			return;
		}

		const context = (event as unknown as { readonly context: UnknownContext }).context;
		const pending = this.#pending.get(context);

		if (pending === undefined) {
			return;
		}

		const requests = [...pending.requests];

		for (const request of requests) {
			const callback = request.callbackRef.deref();
			const consumer = request.consumerRef.deref();

			this.#remove(request, consumer, callback);

			if (consumer !== undefined && callback !== undefined) {
				consumer.dispatchEvent(new ContextRequestEvent(context, consumer, callback, true));
			}
		}
	};

	#remove(request: PendingRequest, consumer?: Element, callback?: ContextCallback<unknown>): void {
		if (!request.active) {
			return;
		}

		request.active = false;

		const pending = this.#pending.get(request.context);

		pending?.requests.delete(request);

		if (pending?.requests.size === 0) {
			this.#pending.delete(request.context);
		}

		consumer ??= request.consumerRef.deref();
		callback ??= request.callbackRef.deref();

		if (consumer === undefined || callback === undefined) {
			return;
		}

		const contexts = this.#pendingByConsumer.get(consumer);
		const callbacks = contexts?.get(request.context);

		callbacks?.delete(callback);

		if (callbacks?.size === 0) {
			contexts?.delete(request.context);
		}

		if (contexts?.size === 0) {
			this.#pendingByConsumer.delete(consumer);
		}
	}
}

/** Returns the one context root shared by owned consumers in a document. */
export const getContextRoot = (ownerDocument: Document): ContextRoot => {
	let root = roots.get(ownerDocument);

	if (root === undefined) {
		root = new ContextRoot(ownerDocument);
		roots.set(ownerDocument, root);
	} else {
		root.attach(ownerDocument);
	}

	return root;
};
