import type { AnyRoute, RouteData, RouteInput, RouteMatch } from "@serve-tools/router";

export * from "@serve-tools/router";

/**
 * Creates a typed browser router on top of the current realm's Navigation API.
 *
 * ```ts
 * import { createRouter, route } from "@serve-tools/client-router";
 *
 * const router = createRouter({
 * 	routes: [
 * 		route("/"),
 * 		route("/login"),
 * 		route("/projects/:projectId", {
 * 			params: { projectId: codec.integer() },
 * 		}),
 * 	],
 * 	render({ current }) {
 * 		// ...
 * 	},
 * });
 *
 * // intercepts navigation and calls `render` with the current route
 * await router.start();
 * ```
 */
export function createRouter<const Routes extends readonly AnyRoute[]>(
	options: ClientRouterOptions<Routes>,
): ClientRouter<Routes[number]> {
	type Value = Routes[number];

	const { navigation, document } = globalThis;
	const { routes, render, shouldIntercept } = options;
	const subscribers = new Set<(current: RouterCurrent<Value> | null) => void>();
	const subscriptionCleanups = new Set<() => void>();

	const validateUnmatched = (fallback: RouterUnmatched<Value>, routes: readonly Value[]): void => {
		if (fallback.mode === "redirect" && !routes.includes(fallback.route)) {
			throw new TypeError("An unmatched redirect route must be installed");
		}
	};

	let installedRoutes: readonly Value[] = [...routes];
	let unmatched: RouterUnmatched<Value> = options.unmatched ?? { mode: "document" };
	let current: RouterCurrent<Value> | null = null;
	let operationController: AbortController | undefined;
	let startPromise: Promise<void> | null | undefined;

	validateUnmatched(unmatched, installedRoutes);

	const match = (url: string | URL): RouteMatch<Value> | null => {
		for (const candidate of installedRoutes) {
			const matched = candidate.match(url);

			if (matched !== null) {
				return matched as RouteMatch<Value>;
			}
		}

		return null;
	};

	const notify = (): void => {
		for (const subscriber of subscribers) {
			try {
				subscriber(current);
			} catch (error) {
				reportError(error);
			}
		}
	};

	const beginOperation = (signal?: AbortSignal): AbortSignal => {
		operationController?.abort();

		operationController = new AbortController();

		return signal === undefined
			? operationController.signal
			: AbortSignal.any([operationController.signal, signal]);
	};

	const present = async (next: RouterCurrent<Value>, signal: AbortSignal, event?: NavigateEvent): Promise<void> => {
		const update = async (): Promise<void> => {
			signal.throwIfAborted();

			const previous = current;

			current = next;

			notify();

			try {
				await render?.({
					current: next,
					match: next.match as RouteMatch<Value>,
					data: next.data as RouteData<Value> | undefined,
					signal,
				});

				signal.throwIfAborted();
			} catch (error) {
				if (current === next) {
					current = previous;

					notify();
				}

				throw error;
			}

			event?.scroll();
		};

		const viewTransition =
			event !== undefined && !event.hasUAVisualTransition ? document?.startViewTransition?.(update) : undefined;

		if (viewTransition === undefined) {
			await update();

			return;
		}

		const skip = (): void => viewTransition.skipTransition();

		signal.addEventListener("abort", skip, { once: true });

		void viewTransition.ready.catch(noop);
		void viewTransition.updateCallbackDone.catch(noop);

		try {
			await viewTransition.finished;

			signal.throwIfAborted();
		} finally {
			signal.removeEventListener("abort", skip);
		}
	};

	const state = (matched: RouteMatch<Value>, status: "loading" | "ready", data: unknown): RouterCurrent<Value> =>
		Object.freeze({ match: matched, status, data }) as RouterCurrent<Value>;

	const run = (
		matched: RouteMatch<Value>,
		signal: AbortSignal,
		event?: NavigateEvent,
		redirectHref?: string,
	): Promise<void> | void => {
		const loading = matched.route.options.loading;
		const loader = loading?.load;
		const blocking = loader !== undefined && loading?.mode === "blocking";

		let data: Promise<RouteData<Value>> | undefined;

		const load = async (): Promise<RouteData<Value>> => {
			const value = await loader?.({ params: matched.params, search: matched.search, url: matched.url, signal });

			signal.throwIfAborted();

			return value as RouteData<Value>;
		};

		const handler = async (): Promise<void> => {
			const pending = loader === undefined ? undefined : (data ??= load());

			if (pending !== undefined && loading?.mode === "deferred") {
				void pending.catch(noop);

				await present(state(matched, "loading", undefined), signal, event);

				event = undefined;
			}

			await present(state(matched, "ready", await pending), signal, event);
		};

		if (event === undefined) {
			return handler();
		}

		const canPrecommit =
			event.cancelable &&
			(redirectHref !== undefined || blocking) &&
			"NavigationPrecommitController" in globalThis;

		if (redirectHref !== undefined && !canPrecommit) {
			if (event.cancelable) {
				claimedEvents.add(event);

				event.preventDefault();

				queueMicrotask(() => navigation.navigate(redirectHref, { history: "replace" }));
			}

			return;
		}

		claimedEvents.add(event);

		event.intercept({
			handler,
			precommitHandler: canPrecommit
				? async (controller): Promise<void> => {
						if (blocking) {
							await (data ??= load());
						}

						if (redirectHref !== undefined) {
							controller.redirect(redirectHref, { history: "replace" });
						}
					}
				: undefined,
			scroll: "manual",
		} as NavigationInterceptOptions);
	};

	const onNavigate = (rawEvent: Event): void => {
		if (claimedEvents.has(rawEvent) || rawEvent.defaultPrevented) {
			return;
		}

		const event = rawEvent as NavigateEvent;

		if (
			!event.canIntercept ||
			event.navigationType === "reload" ||
			event.hashChange ||
			event.downloadRequest !== null ||
			event.formData !== null
		) {
			return;
		}

		let matched = match(event.destination.url);

		if (matched === null && unmatched.mode === "document") {
			return;
		}

		if (shouldIntercept?.({ match: matched, event }) === false) {
			return;
		}

		let redirectHref: string | undefined;

		if (matched === null && unmatched.mode === "redirect") {
			redirectHref = unmatched.route.href(unmatched.input as never);
			matched = match(redirectHref);
		}

		if (matched !== null) {
			run(matched, beginOperation(event.signal), event, redirectHref);

			return;
		}

		if (unmatched.mode === "preserve") {
			const signal = beginOperation(event.signal);

			claimedEvents.add(event);

			event.intercept({
				handler: () => {
					signal.throwIfAborted();
					event.scroll();
				},
				focusReset: "manual",
				scroll: "manual",
			});
		}
	};

	const start = (): Promise<void> => {
		if (startPromise === null) {
			throw new TypeError("Cannot use a disposed router");
		}

		if (startPromise !== undefined) {
			return startPromise;
		}

		startPromise = Promise.resolve();

		navigation.addEventListener("navigate", onNavigate);

		startPromise = (async () => {
			const url = navigation.currentEntry?.url;

			if (url === undefined || url === null) {
				return;
			}

			const matched = match(url);

			if (matched === null) {
				if (unmatched.mode === "redirect") {
					const href = unmatched.route.href(unmatched.input as never);

					await navigation.navigate(href, { history: "replace" }).finished;
				}

				return;
			}

			const signal = beginOperation();

			await run(matched, signal);
		})();

		return startPromise;
	};

	const stop = (): void => {
		if (startPromise === undefined || startPromise === null) {
			return;
		}

		navigation.removeEventListener("navigate", onNavigate);

		operationController?.abort();

		operationController = undefined;

		startPromise = undefined;
	};

	const dispose = (): void => {
		if (startPromise === null) {
			return;
		}

		stop();

		startPromise = null;

		for (const cleanup of subscriptionCleanups) {
			cleanup();
		}
	};

	return {
		get current() {
			return current;
		},
		get transition() {
			return navigation.transition;
		},
		start,
		stop,
		dispose,
		match,
		navigate(route, ...arguments_) {
			if (!installedRoutes.includes(route)) {
				throw new TypeError("Cannot navigate to an uninstalled route");
			}

			const [input, navigateOptions] = arguments_;

			return navigation.navigate(route.href(input as never), navigateOptions) as RouterNavigationResult;
		},
		setRoutes(nextRoutes, setOptions) {
			const replacement = [...nextRoutes];
			const nextUnmatched = setOptions?.unmatched ?? unmatched;

			validateUnmatched(nextUnmatched, replacement);

			operationController?.abort();

			installedRoutes = replacement;
			unmatched = nextUnmatched;

			if (current !== null && !installedRoutes.includes(current.match.route)) {
				current = null;

				notify();
			}
		},
		subscribe(subscriber, subscribeOptions) {
			if (startPromise === null) {
				throw new TypeError("Cannot use a disposed router");
			}

			if (subscribeOptions?.signal?.aborted) {
				return noop;
			}

			subscribers.add(subscriber);

			const signal = subscribeOptions?.signal;
			const unsubscribe = (): void => {
				subscribers.delete(subscriber);
				signal?.removeEventListener("abort", unsubscribe);
				subscriptionCleanups.delete(unsubscribe);
			};

			subscriptionCleanups.add(unsubscribe);

			signal?.addEventListener("abort", unsubscribe, { once: true });

			return unsubscribe;
		},
	};
}

const claimedEvents = new WeakSet<Event>();
const noop = (): void => undefined;

/** The native navigation result with both platform promises known to be present. */
export type RouterNavigationResult = NavigationResult & Required<Pick<NavigationResult, "committed" | "finished">>;

/** The route and fulfilled data currently presented by a browser router. */
export type RouterCurrent<Value extends AnyRoute = AnyRoute> = Value extends AnyRoute
	? Readonly<
			| {
					match: RouteMatch<Value>;
					status: "loading";
					data: undefined;
			  }
			| {
					match: RouteMatch<Value>;
					status: "ready";
					data: RouteData<Value>;
			  }
		>
	: never;

/** Values supplied when a browser router presents a matched route. */
export interface RouterRenderOptions<Value extends AnyRoute = AnyRoute> {
	readonly current: RouterCurrent<Value>;
	readonly match: RouteMatch<Value>;
	readonly data: RouteData<Value> | undefined;
	readonly signal: AbortSignal;
}

/** Presents a matched route inside the current document. */
export type RouterRender<Value extends AnyRoute = AnyRoute> = (
	options: RouterRenderOptions<Value>,
) => void | PromiseLike<void>;

/** Leaves an unmatched navigation to normal document navigation. */
export interface RouterDocumentFallback {
	readonly mode: "document";
}

/** Converts an unmatched navigation to same-document navigation while preserving the current presentation. */
export interface RouterPreserveFallback {
	readonly mode: "preserve";
}

/** Redirects an unmatched navigation to one installed route. */
export type RouterRedirectFallback<Value extends AnyRoute> = Value extends AnyRoute
	? Readonly<
			{ mode: "redirect"; route: Value } & (Record<never, never> extends RouteInput<Value>
				? { input?: RouteInput<Value> }
				: { input: RouteInput<Value> })
		>
	: never;

/** The behavior used when no installed route matches a destination. */
export type RouterUnmatched<Value extends AnyRoute> =
	| RouterDocumentFallback
	| RouterPreserveFallback
	| RouterRedirectFallback<Value>;

/** The original destination and native event considered for same-document navigation. */
export interface RouterInterceptOptions<Value extends AnyRoute = AnyRoute> {
	readonly match: RouteMatch<Value> | null;
	readonly event: NavigateEvent;
}

/** Browser-router construction options. */
export interface ClientRouterOptions<Routes extends readonly AnyRoute[]> {
	readonly routes: Routes;
	readonly unmatched?: NoInfer<RouterUnmatched<Routes[number]>>;
	readonly render?: NoInfer<RouterRender<Routes[number]>>;

	/** Synchronously returns false to leave a navigation to the browser or another router. */
	readonly shouldIntercept?: NoInfer<(options: RouterInterceptOptions<Routes[number]>) => boolean>;
}

/** Options for replacing the installed routes. */
export interface SetRoutesOptions<Value extends AnyRoute> {
	readonly unmatched: RouterUnmatched<Value>;
}

/** A browser router that delegates history and navigation phases to the Navigation API. */
export interface ClientRouter<Value extends AnyRoute = AnyRoute> {
	readonly current: RouterCurrent<Value> | null;
	readonly transition: NavigationTransition | null;

	/** Starts navigation interception and presents the current entry. */
	start(): Promise<void>;

	/** Stops navigation interception and cancels router-owned work. */
	stop(): void;

	/** Stops this router permanently and removes its subscriptions. */
	dispose(): void;

	/** Matches a URL against the installed routes in list order. */
	match(url: string | URL): RouteMatch<Value> | null;

	/** Navigates through the current realm's native Navigation object. */
	navigate<RouteValue extends AnyRoute>(
		route: RouteValue extends Value ? RouteValue : never,
		...arguments_: Record<never, never> extends RouteInput<RouteValue>
			? [input?: RouteInput<RouteValue>, options?: NavigationNavigateOptions]
			: [input: RouteInput<RouteValue>, options?: NavigationNavigateOptions]
	): RouterNavigationResult;

	/** Replaces the identity-based list of routes installed in this router. */
	setRoutes(routes: readonly Value[], options?: SetRoutesOptions<Value>): void;

	/** Observes presented route changes. */
	subscribe(
		subscriber: (current: RouterCurrent<Value> | null) => void,
		options?: { signal?: AbortSignal },
	): () => void;
}
