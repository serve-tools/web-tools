export const tasks = [
	{
		id: "route-catalog",
		title: "Typed route catalog",
		prompt: `Create a single solution.ts module that exports createRouteCatalog().

The returned object must expose build(kind, input) and parse(url).
Support these route kinds:

- project: /projects/:projectId with an integer projectId and search values view ("summary" or "activity", default "summary"), tag (repeated strings, default []), and q (optional string).
- projectSettings: /projects/:projectId/settings with an integer projectId and section ("profile" or "security", default "profile").
- asset: /assets/:assetId.:format with string assetId and format ("png" or "webp").

build() must return a relative href and omit defaulted or absent search values. It must encode pathname and search data with URL semantics and preserve repeated tag order. Invalid kinds or invalid inputs must throw TypeError.

parse() accepts an absolute URL, relative URL, or URL object. It returns null for an unmatched or invalid URL. Otherwise it returns { kind, params, search }, using the decoded types and defaults above. Prefer the most specific matching route, so projectSettings is not parsed as project. Unknown search keys are ignored, while a repeated scalar search key is invalid. Integer syntax must be canonical and safe, so values such as 01 and unsafe integers do not match.

Use a typed reversible-route capability rather than maintaining separate parsing and formatting rules. The module must not modify globals.`,
		packages: ["@serve-tools/router"],
		requiredRuntimeImports: [["@serve-tools/router"]],
		smokePath: "tasks/route-catalog/smoke.mjs",
		hiddenPath: "tasks/route-catalog/hidden.mjs",
		fixturePath: "tasks/route-catalog/solution.fixture.ts",
	},
	{
		id: "batch-operation",
		title: "Cancellable batch operation",
		prompt: `Create a single solution.ts module that exports createBatchOperation(items, transform, options?).

The function must return an owned asynchronous operation that starts immediately, is async iterable, exposes result, finished, signal, abort(reason), and Symbol.asyncDispose, and honors options.signal and options.highWaterMark.

Process items sequentially. Call await transform(item, index, signal) for each item. Stream one ordered observation per item as { index, status: "fulfilled", value } or { index, status: "rejected", reason }. A transform failure is an item result and must not stop later items. After all items, fulfill result with { fulfilled, rejected } counts.

Await delivery of every observation so consumer backpressure bounds producer progress. options.highWaterMark defaults to 0 and, when supplied, must be a non-negative finite integer used as the readable-side count capacity. Upstream abort, abort(reason), early iterator return, or async disposal must cancel the complete operation and expose one canonical abort reason through signal and result. finished must fulfill only after the transform loop and cleanup have stopped, even on cancellation. Do not turn cancellation into a rejected item observation.

Use an owned async-operation capability; do not implement a second stream/result/cancellation state machine.`,
		packages: ["@serve-tools/async-operation"],
		requiredRuntimeImports: [["@serve-tools/async-operation"]],
		smokePath: "tasks/batch-operation/smoke.mjs",
		hiddenPath: "tasks/batch-operation/hidden.mjs",
		fixturePath: "tasks/batch-operation/solution.fixture.ts",
	},
	{
		id: "inventory-http-handler",
		title: "Typed in-memory inventory handler",
		prompt: `Create a single solution.ts module that exports createInventoryHandler(initial = []).

Return a Fetch-style function (request: Request) => Promise<Response> implementing a typed JSON API:

- GET /items/:itemId returns 200 with { id, name, quantity }, or 404 with { error: "not_found" }.
- PUT /items/:itemId accepts { name: string, quantity: non-negative safe integer }, stores it under the positive safe integer path id, and returns 204 with no body.

The path must use a typed integer route codec. Reject non-canonical, zero, negative, or unsafe ids with the contract adapter's 400 { error: "invalid_request" } JSON response. Validate PUT JSON through a Standard Schema value supplied to the HTTP contract, rather than hand-validating inside the handler. The contract adapter must also own malformed JSON, non-JSON media type, and body size failures, producing 400 { error: "invalid_request" }, 415 { error: "unsupported_media_type" }, and 413 { error: "request_too_large" } JSON responses. Set maxBodyBytes to 256. Unsupported methods for the matched route must produce 405 { error: "method_not_allowed" } with the adapter's normal Allow header behavior. Clone initial records so callers cannot mutate stored state through their input.

Use a typed HTTP contract with its trusted Fetch handler and shared typed route; do not start a server or call the network.`,
		packages: ["@serve-tools/http-contract", "@serve-tools/router", "@standard-schema/spec"],
		requiredRuntimeImports: [
			["@serve-tools/http-contract", "@serve-tools/http-contract/server"],
			["@serve-tools/router"],
		],
		smokePath: "tasks/inventory-http-handler/smoke.mjs",
		hiddenPath: "tasks/inventory-http-handler/hidden.mjs",
		fixturePath: "tasks/inventory-http-handler/solution.fixture.ts",
	},
	{
		id: "reactive-leaderboard",
		title: "Batched reactive leaderboard",
		prompt: `Create a single solution.ts module that exports createReactiveLeaderboard(initial, publish).

Return { setScore(id, score), remove(id), snapshot(), dispose() }.
ids are strings and scores are finite numbers; invalid writes must throw TypeError without changing state.
Initial entries may be an iterable of [id, score] pairs.

snapshot() returns a fresh array of { id, score } sorted by descending score and then ascending id. setScore replaces or inserts one score. remove returns whether an entry existed. publish(snapshot) must run synchronously once during creation, then at most once per microtask after any number of synchronous effective changes. No-op sets and removing a missing id must not publish. A published snapshot must be isolated from later mutations.

dispose() is idempotent, cancels a queued publish, and prevents future publishing while leaving snapshot() and mutations usable. Use signal-aware native-shaped collections for keyed state and a microtask-batched signal effect for publication.`,
		packages: ["@serve-tools/signal", "@serve-tools/signal-collections", "@serve-tools/signal-effect"],
		requiredRuntimeImports: [
			["@serve-tools/signal-collections", "@serve-tools/signals", "@serve-tools/signals/collections"],
			["@serve-tools/signal-effect", "@serve-tools/signals", "@serve-tools/signals/effect"],
		],
		smokePath: "tasks/reactive-leaderboard/smoke.mjs",
		hiddenPath: "tasks/reactive-leaderboard/hidden.mjs",
		fixturePath: "tasks/reactive-leaderboard/solution.fixture.ts",
	},
	{
		id: "document-channel",
		title: "Owned document MessageChannel",
		prompt: `Create a single solution.ts module that exports async openDocumentChannel(initialText = "").

Create a private Node-compatible MessageChannel and serve a typed messaging protocol on one port while connecting a client on the other. Wait for the protocol handshake before resolving. Return an object with:

- read(): Promise<string>
- replace(text: string): Promise<number>, which stores text and returns its new UTF-8 byte length
- bytes(): Promise<ArrayBuffer>, whose buffer is transferred from the serving side
- subscribe(listener): a subscription handle with unsubscribe() and native Symbol.dispose; both are idempotent. It receives the current { text, version } immediately and each later replacement in order
- close(reason?): void and closed: Promise<void>

Versions start at 0 and increment once per successful replace, including replacement with the same text. Several subscribers receive the same updates. Disposing a subscription stops only that subscriber and runs its serving cleanup once. Closing is idempotent, closes both protocol peers and both MessagePorts, terminates active subscriptions, and prevents later operations from hanging. Expose remote handler failures as rejections. Do not use global navigator or Web Locks; the messaging library must degrade normally when they are absent.

openDocumentChannel() with non-string initialText must reject with TypeError. A non-string replace input must reject with a remote TypeError without changing document state.

Use the typed request/subscription, transfer, handshake, and disposal capabilities of a MessagePort messaging package.`,
		packages: ["@serve-tools/client-messaging"],
		requiredRuntimeImports: [["@serve-tools/client-messaging"]],
		smokePath: "tasks/document-channel/smoke.mjs",
		hiddenPath: "tasks/document-channel/hidden.mjs",
		fixturePath: "tasks/document-channel/solution.fixture.ts",
	},
	{
		id: "opaque-cursor",
		title: "Versioned opaque cursor",
		prompt: `Create a single solution.ts module that exports encodeCursor(input) and decodeCursor(token).

input is { offset, label }, where offset is a non-negative safe integer and label is a string. Encode a deterministic UTF-8 payload containing exactly version 1, offset, and label, then return unpadded base64url text. Use the mutation-free Node Uint8Array base64 ponyfill for encoding. The encoded view must include exactly the payload bytes even when it is a subarray of a larger backing buffer.

decodeCursor reverses the format and returns a fresh { offset, label } object. It must reject with TypeError for non-string input, padding, standard-base64 characters, non-canonical base64url spelling, invalid UTF-8, invalid JSON or shape, extra payload properties, unsupported versions, and invalid offsets. Labels must round trip all well-formed Unicode strings; lone surrogates are invalid input. No globals or built-in prototypes may be modified.`,
		packages: ["@serve-tools/ponyfill-arraybuffer-base64"],
		requiredRuntimeImports: [
			["@serve-tools/ponyfill-arraybuffer-base64", "@serve-tools/ponyfill-arraybuffer-base64/runtime/node"],
		],
		smokePath: "tasks/opaque-cursor/smoke.mjs",
		hiddenPath: "tasks/opaque-cursor/hidden.mjs",
		fixturePath: "tasks/opaque-cursor/solution.fixture.ts",
	},
	{
		id: "resource-scope",
		title: "Mixed resource scope",
		prompt: `Create a single solution.ts module that exports runResourceScope(acquire, work).

acquire receives a registrar with use(resource), adopt(value, dispose), and defer(dispose). It may return a value or promise. work receives the acquired value and may return a value or promise. runResourceScope resolves with work's result after all cleanup finishes.

Own registrations with the mutation-free ponyfill's AsyncDisposableStack and its exported dispose/asyncDispose symbols. use(resource) must accept package-protocol async resources and package-protocol sync resources. adopt and defer may return promises from cleanup. Dispose in exact reverse registration order on success, work failure, or acquisition failure. If work and cleanup fail, or several cleanups fail, preserve the package's nested SuppressedError behavior and identities. Reject invalid resources as the stack does. Do not consult native Symbol.dispose or Symbol.asyncDispose and do not modify globals.`,
		packages: ["@serve-tools/ponyfill-resource-management"],
		requiredRuntimeImports: [["@serve-tools/ponyfill-resource-management"]],
		smokePath: "tasks/resource-scope/smoke.mjs",
		hiddenPath: "tasks/resource-scope/hidden.mjs",
		fixturePath: "tasks/resource-scope/solution.fixture.ts",
	},
	{
		id: "deferred-projection",
		title: "Deferred reactive projection",
		prompt: `Create a single solution.ts module that exports createDeferredProjection(initial, publish).

Return { setItems(items), setLimit(limit), setEnabled(enabled), start(), snapshot(), dispose() }.
initial is { items, limit, enabled } with the same value rules as the setters.
Items are finite numbers. limit is a non-negative safe integer. enabled is boolean. Invalid values must throw TypeError without changing state.

snapshot() returns a fresh array: when enabled, take the first limit current items, square them, and retain their order; when disabled, return []. start() is idempotent and, unless already disposed, publishes the current snapshot synchronously and begins observing only the state read by that projection. Later effective mutations are batched to at most one publish per microtask. Changes to items or limit while disabled must not queue a publish; enabling later publishes their latest values. setItems must copy its input, and published arrays must not be mutated later.

dispose() is idempotent. Disposal before start permanently prevents start. Disposal after a mutation cancels a queued publication. Mutations and snapshot() remain usable after disposal. Use signal-aware array/object state and a dormant signal effect controller rather than a permanently active effect.`,
		packages: ["@serve-tools/signal", "@serve-tools/signal-collections", "@serve-tools/signal-effect"],
		requiredRuntimeImports: [
			["@serve-tools/signal-collections", "@serve-tools/signals", "@serve-tools/signals/collections"],
			["@serve-tools/signal-effect", "@serve-tools/signals", "@serve-tools/signals/effect"],
		],
		smokePath: "tasks/deferred-projection/smoke.mjs",
		hiddenPath: "tasks/deferred-projection/hidden.mjs",
		fixturePath: "tasks/deferred-projection/solution.fixture.ts",
	},
];
