import { vi } from "vitest";

export interface FakeNavigateOptions {
	readonly canIntercept?: boolean;
	readonly cancelable?: boolean;
	readonly downloadRequest?: string | null;
	readonly formData?: FormData | null;
	readonly hasUAVisualTransition?: boolean;
	readonly hashChange?: boolean;
}

export class FakeNavigateEvent extends Event {
	readonly canIntercept: boolean;
	readonly downloadRequest: string | null;
	readonly formData: FormData | null;
	readonly hasUAVisualTransition: boolean;
	readonly hashChange: boolean;
	readonly info = undefined;
	readonly navigationType: NavigationType = "push";
	readonly signal: AbortSignal;
	readonly sourceElement = null;
	readonly userInitiated = false;
	readonly destination: NavigationDestination;
	interceptOptions: NavigationInterceptOptions | undefined;
	scrollCalls = 0;
	onScroll: (() => void) | undefined;

	constructor(url: string, signal: AbortSignal, options: FakeNavigateOptions = {}) {
		super("navigate", { cancelable: options.cancelable ?? true });
		this.canIntercept = options.canIntercept ?? true;
		this.downloadRequest = options.downloadRequest ?? null;
		this.formData = options.formData ?? null;
		this.hasUAVisualTransition = options.hasUAVisualTransition ?? false;
		this.hashChange = options.hashChange ?? false;
		this.signal = signal;
		this.destination = {
			id: "",
			index: -1,
			key: "",
			sameDocument: false,
			url,
			getState: () => undefined,
		};
	}

	intercept(options: NavigationInterceptOptions = {}): void {
		this.interceptOptions = options;
	}

	scroll(): void {
		++this.scrollCalls;
		this.onScroll?.();
	}
}

interface PendingNavigation {
	readonly controller: AbortController;
	readonly event: FakeNavigateEvent;
}

export class FakeNavigation extends EventTarget {
	currentEntry: NavigationHistoryEntry | null;
	transition: NavigationTransition | null = null;
	readonly events: FakeNavigateEvent[] = [];
	readonly results: Array<Required<NavigationResult>> = [];
	onScroll: (() => void) | undefined;
	nextOptions: FakeNavigateOptions | undefined;
	private pending: PendingNavigation | undefined;
	private readonly baseURL: string;

	constructor(url?: string) {
		super();
		this.baseURL = url ?? (globalThis.location?.origin || "https://example.test/");
		this.currentEntry = url === undefined ? null : entry(url);
	}

	navigate(url: string | URL, _options?: NavigationNavigateOptions): Required<NavigationResult> {
		this.pending?.controller.abort(new DOMException("The navigation was superseded", "AbortError"));

		const base = this.currentEntry?.url ?? this.baseURL;
		const baseURL = new URL(base);
		const destinationURL = new URL(url, baseURL);
		const destination = destinationURL.href;
		const controller = new AbortController();
		const event = new FakeNavigateEvent(destination, controller.signal, {
			...this.nextOptions,
			canIntercept:
				this.nextOptions?.canIntercept ??
				((destinationURL.protocol === "http:" || destinationURL.protocol === "https:") &&
					destinationURL.origin === baseURL.origin),
		});
		this.nextOptions = undefined;
		event.onScroll = this.onScroll;
		this.events.push(event);
		this.pending = { controller, event };

		const committed = Promise.withResolvers<NavigationHistoryEntry>();
		const finished = Promise.withResolvers<NavigationHistoryEntry>();
		const result = { committed: committed.promise, finished: finished.promise };
		this.results.push(result);
		this.dispatchEvent(event);
		void this.complete(event, committed, finished);

		return result;
	}

	private async complete(
		event: FakeNavigateEvent,
		committed: PromiseWithResolvers<NavigationHistoryEntry>,
		finished: PromiseWithResolvers<NavigationHistoryEntry>,
	): Promise<void> {
		try {
			if (event.defaultPrevented) {
				throw new DOMException("The navigation was prevented", "AbortError");
			}

			const handlers: NavigationInterceptHandler[] = [];
			await event.interceptOptions?.precommitHandler?.({
				addHandler(handler) {
					handlers.push(handler);
				},
				redirect: (url) => {
					(event.destination as { url: string }).url = new URL(url, event.destination.url).href;
				},
			});
			event.signal.throwIfAborted();

			const destination = entry(event.destination.url);
			this.currentEntry = destination;
			committed.resolve(destination);
			await Promise.all([event.interceptOptions?.handler?.(), ...handlers.map((handler) => handler())]);
			event.signal.throwIfAborted();
			finished.resolve(destination);
		} catch (error) {
			committed.reject(error);
			finished.reject(error);
		} finally {
			if (this.pending?.event === event) {
				this.pending = undefined;
			}
		}
	}
}

export function fakeNavigation(url?: string): FakeNavigation {
	const value = new FakeNavigation(url);
	vi.stubGlobal("navigation", value);

	return value;
}

function entry(url: string): NavigationHistoryEntry {
	return {
		id: crypto.randomUUID(),
		index: 0,
		key: crypto.randomUUID(),
		sameDocument: true,
		url,
		getState: () => undefined,
		addEventListener: () => undefined,
		dispatchEvent: () => true,
		removeEventListener: () => undefined,
	} as unknown as NavigationHistoryEntry;
}
