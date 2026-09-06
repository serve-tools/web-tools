# Experimental connection resources

`src/lib/DisposableElement.ts` is an internal candidate base, not the exported `BaseElement` API.
It owns connection resources without rebuilding DOM or removing instance-owned listeners.

Static `disposables` factories run synchronously on connection and may return one cleanup function.
Factories receive the host and can call `host.disconnectedSignal()` for cancellable work.
A factory failure is reported unchanged and does not prevent other factories from running.
Factories must release partially acquired resources themselves if they throw before returning cleanup.

Disconnection, `dispose()`, and `[Symbol.dispose]()` abort all requested signals before draining cleanup in reverse order.
Cleanup failures do not prevent remaining cleanup or later reconnection.
A single cleanup error is rethrown unchanged; multiple errors follow native `DisposableStack` suppression semantics.
Repeated disposal is harmless; explicit disposal does not remove the element or automatically restart it.
An actual reconnection event during cleanup still starts a fresh connection after the old transition finishes.
Cleanup returned after a factory disconnects or disposes the host runs immediately, and remaining factories are skipped.

Each `disconnectedSignal()` call creates an independent signal that stays live until the next disposal.
This includes signals requested while detached, before first connection, or during an earlier scope's abort or cleanup.
Disposed signals remain aborted; subsequent calls create new signals even before reconnection.
Elements without factories allocate no stack, and controllers are allocated only when a signal is requested.

The primitive requires `DisposableStack` and `Symbol.dispose` and does not install global polyfills.
The browser tests apply the repository's resource-management polyfill before importing the primitive.

Same-document connected moves preserve resources.
Document adoption ends old-document ownership and reacquires resources when connected.
Ancestor-dependent behavior during a same-document move remains the subclass's responsibility.

Connections follow browser lifecycle callbacks synchronously, while reentrant connection setup waits for the active setup or cleanup transition to finish.
This prevents an old cleanup from releasing an identically keyed resource that a fresh connection just reacquired.
A connection that changes connectivity again during its one immediate retry fails closed and reports an error instead of recurring.
Cleanup must still capture its own resources because a later connection can reuse the same factory.
As with other lifecycle callbacks, factories must not unconditionally disconnect and reconnect their own host.

## Archived constructor metadata sketch

The following types preserve an earlier design sketch; they are not exported or supported APIs.
Neither `BaseElement` nor `DisposableElement` implements these constructor metadata fields.

````ts
export type Adoptions<THost extends HTMLElement, TResource = any> = readonly [
	factory: (host: THost) => TResource,
	cleanup: (resource: TResource) => void,
];

export interface ElementConstructor {
	adoptions: readonly ElementAdoption[];
	aria: ElementConstructor.ARIA;
	customStates: ElementConstructor.CustomStates;
	elements: ElementConstructor.Definitions;
	prototype: HTMLElement & {
		constructor: ElementConstructor;
	};
}

export namespace ElementConstructor {
	export type Adoptions = readonly ElementAdoption[];
	export type ARIA = ElementARIAMap;
	export type CustomStates = ElementCustomStateMap;
	export type Definitions = ElementDefinitionsMap;
}

export interface ElementAdoption {
	(
		host: HTMLElement,
	): {
		(): void;
	};
}

/**
 * Represents the ARIA attributes that can be set on an element.
 */
export interface ElementARIAMap extends Partial<ARIAMixin> {}

/**
 * Represents element definitions for a custom element registry.
 */
export interface ElementDefinitionsMap {
	[name: string]: typeof HTMLElement;
}

/**
 * The internal {@link CustomStateSet} states exposed by the element and whether they are active on construction.
 *
 * ```jsonc
 * {
 * 	"invalid": false, // exposes :state(invalid)
 * 	"expanded": true, // exposes :state(expanded)
 * }
 * ```
 */
export interface ElementCustomStateMap {
	[state: string]: boolean;
}
````
