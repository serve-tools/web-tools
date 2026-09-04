export const tasks = [
	{
		id: "workspace-links",
		title: "Canonical typed workspace links",
		prompt: `Create a single solution.ts module that exports createWorkspaceLinks().

The returned object exposes build(kind, input) and inspect(url).
It owns these reversible routes:

- board: /teams/:teamId/boards/:boardId, with positive safe integer teamId and boardId path values; mode ("cards" or "table", default "cards"), lane (repeated strings, default []), and focus (optional positive safe integer) search values.
- invite: /teams/:teamId/invite/:token, with a positive safe integer teamId and a string token; role ("viewer" or "editor", default "viewer") search value.

build() returns the relative href, omitting defaults and absent values and preserving lane order. It throws TypeError for an unknown kind, missing input, non-positive/non-safe integers, null in place of an omitted optional/defaulted value, invalid enum values, malformed Unicode, or a token/path string that cannot round trip.

inspect() accepts an absolute URL, relative URL, or URL object. It returns null for unmatched or invalid URLs. Otherwise it returns { kind, params, search, canonicalHref }. canonicalHref is rebuilt from the decoded match, so it removes unknown search keys, omits explicit defaults, and retains declared repeated values in order. Repeated scalar search values are invalid. Integer wire syntax is canonical, so 01 and unsafe integers do not match. Prefer the more specific invite route where relevant.

Use typed reversible routes for both matching and canonical rebuilding. Do not maintain a separate parser/formatter or modify globals.`,
		packages: ["@serve-tools/router"],
		requiredRuntimeImports: [["@serve-tools/router"]],
		smokePath: "transfer/tasks/workspace-links/smoke.mjs",
		hiddenPath: "transfer/tasks/workspace-links/hidden.mjs",
		fixturePath: "transfer/tasks/workspace-links/solution.fixture.ts",
		requirementMatrix: [
			row(
				"routes",
				"both route kinds and valid typed inputs",
				"example",
				"smoke+hidden",
				"round trips and seeded href cases",
				["route-default-mutant"],
			),
			row(
				"invalid-build",
				"unknown kinds, integer boundaries, null mode/lane/focus values, enum and path strings",
				"boundary",
				"smoke+hidden",
				"build rejection tables",
				["route-positive-mutant"],
			),
			row(
				"inspect",
				"absolute, relative and URL inputs plus unmatched URLs",
				"example",
				"smoke+hidden",
				"typed inspection blocks",
				["route-default-mutant"],
			),
			row(
				"canonical",
				"unknown keys, explicit defaults, repeated lanes and repeated scalars",
				"property",
				"smoke+hidden",
				"canonicalization and seeded lane cases",
				["route-default-mutant"],
			),
		],
	},
	{
		id: "page-operation",
		title: "Backpressured page loading operation",
		prompt: `Create a single solution.ts module that exports createPageOperation(pages, load, options?).

Return an owned asynchronous operation that starts immediately, is async iterable, and exposes result, finished, signal, abort(reason), and Symbol.asyncDispose. pages is a synchronous iterable of positive safe integers. Process pages sequentially. For each page, await load(page, index, signal), require its result to be a non-negative safe integer record count, then await delivery of { page, index, records }. Stop on the first thrown load error or invalid record count; iteration and result reject with that exact reason (use a new TypeError for an invalid count). On success result fulfills with { pages: numberOfPages, records: sum }.

Validate load, pages, and every yielded page. Sparse arrays therefore fail at the hole before load is called for it. Synchronous validation discovered by the executor may surface through the operation's iteration/result. options must be an object when supplied. options.highWaterMark defaults only when undefined; null is invalid. A supplied highWaterMark must be a non-negative finite integer and controls readable-side count capacity. options.signal, when supplied, must be an AbortSignal.

Await every observation so consumer backpressure bounds producer progress. Upstream abort, abort(reason), early iterator return, or async disposal cancels the whole operation. Expose the same canonical abort reason through signal and result, do not emit a page after cancellation, and make finished fulfill only after load/executor cleanup has stopped.

Use the owned async-operation capability rather than implementing another stream/result/cancellation state machine.`,
		packages: ["@serve-tools/async-operation"],
		requiredRuntimeImports: [["@serve-tools/async-operation"]],
		smokePath: "transfer/tasks/page-operation/smoke.mjs",
		hiddenPath: "transfer/tasks/page-operation/hidden.mjs",
		fixturePath: "transfer/tasks/page-operation/solution.fixture.ts",
		requirementMatrix: [
			row(
				"success",
				"ordered pages, indices, record counts and totals",
				"property",
				"smoke+hidden",
				"success and seeded page sequences",
				["operation-total-mutant"],
			),
			row(
				"validation",
				"load, options, highWaterMark including null, signal, sparse and invalid pages/counts",
				"boundary",
				"smoke+hidden",
				"validation tables",
				["operation-page-mutant"],
			),
			row(
				"failure",
				"load failures and invalid count failures",
				"identity",
				"smoke+hidden",
				"terminal error identity blocks",
				["operation-page-mutant"],
			),
			row(
				"ownership",
				"manual/upstream/iterator/disposal cancellation and finished cleanup",
				"interaction",
				"smoke+hidden",
				"cancellation lifecycle blocks",
				["operation-cancel-mutant"],
			),
			row(
				"backpressure",
				"zero and positive readable capacities",
				"interaction",
				"smoke+hidden",
				"producer run-ahead blocks",
				["operation-backpressure-mutant"],
			),
		],
	},
	{
		id: "preference-handler",
		title: "Typed nullable preference handler",
		prompt: `Create a single solution.ts module that exports createPreferenceHandler(initial = []).

Return a Fetch-style function (request: Request) => Promise<Response> for /users/:userId/preferences/:key. userId is a positive safe integer encoded with a typed integer route codec. key is "theme" or "nickname" encoded with a typed enum route codec.

- GET returns 200 with { key, value } where value is string or null, or 404 with { error: "not_found" }.
- PATCH accepts exactly { value: string | null }, stores it, and returns 200 with { key, value }.
- DELETE removes an existing preference and returns 204 with no body; deleting a missing preference returns 404.

Validate PATCH JSON with a Standard Schema supplied to the HTTP contract. Missing value, undefined, arrays, and extra properties are invalid; null is a valid stored value distinct from missing. Let the trusted contract adapter own malformed JSON, media type, body-size, route-codec, and method failures. Use maxBodyBytes 128 and JSON errors { error: "invalid_request" }, { error: "unsupported_media_type" }, { error: "request_too_large" }, and { error: "method_not_allowed" } for 400, 415, 413, and 405. Preserve the adapter's Allow behavior without relying on header value ordering.

Clone and validate initial { userId, key, value } records so later caller mutation cannot affect state; duplicate records use the last value. Use a typed HTTP contract, its trusted Fetch handler, and the shared typed route. Do not start a server or call the network.`,
		packages: ["@serve-tools/http-contract", "@serve-tools/router", "@standard-schema/spec"],
		requiredRuntimeImports: [
			["@serve-tools/http-contract"],
			["@serve-tools/http-contract/server", "@serve-tools/http-contract"],
			["@serve-tools/router"],
		],
		smokePath: "transfer/tasks/preference-handler/smoke.mjs",
		hiddenPath: "transfer/tasks/preference-handler/hidden.mjs",
		fixturePath: "transfer/tasks/preference-handler/solution.fixture.ts",
		requirementMatrix: [
			row(
				"methods",
				"GET, PATCH and DELETE for present/missing values",
				"example",
				"smoke+hidden",
				"method lifecycle blocks",
				["http-delete-mutant"],
			),
			row(
				"route",
				"canonical positive safe userId and theme/nickname keys",
				"boundary",
				"smoke+hidden",
				"route rejection table",
				[],
			),
			row(
				"body",
				"exact object shape, string/null value, malformed JSON, media type and 128-byte limit",
				"boundary",
				"smoke+hidden",
				"adapter body tables",
				["http-body-mutant", "http-limit-mutant"],
			),
			row(
				"adapter",
				"unsupported methods and Allow membership",
				"interaction",
				"smoke+hidden",
				"method failure block",
				[],
			),
			row(
				"initial",
				"validated cloned records and last duplicate",
				"example",
				"hidden",
				"initial-state isolation block",
				["http-clone-mutant"],
			),
		],
	},
	{
		id: "reactive-cart",
		title: "Reactive cart with taxed membership",
		prompt: `Create a single solution.ts module that exports createReactiveCart(initial, publish).

initial is an iterable of { id, price, quantity, taxed }. Return { set(id, price, quantity, taxed), remove(id), snapshot(), dispose() }. ids are non-empty strings, price is a finite non-negative number, quantity is a non-negative safe integer, and taxed is boolean. Validate every record before changing reactive state; sparse arrays are invalid because holes are invalid records. Duplicate initial ids use the last record. Invalid calls throw TypeError without partial changes.

snapshot() returns a fresh { lines, subtotal, taxedSubtotal }, where lines is a fresh array of fresh { id, price, quantity, taxed, amount } records sorted by ascending id, amount is price * quantity, subtotal sums all amounts, and taxedSubtotal sums only taxed amounts. set replaces or inserts one whole line. A logically identical set is a no-op. remove validates id and returns whether it existed.

publish(snapshot) runs synchronously once during creation, then at most once per microtask after any number of synchronous effective changes. No-op sets and missing removals do not publish. Published objects and nested lines must remain isolated from later changes. dispose() is idempotent, cancels a queued publication, and prevents future publishing while leaving snapshot and mutations usable.

Use signal-aware native-shaped keyed and membership collections plus a microtask-batched signal effect.`,
		packages: ["@serve-tools/signal", "@serve-tools/signal-collections", "@serve-tools/signal-effect"],
		requiredRuntimeImports: [
			["@serve-tools/signal-collections", "@serve-tools/signals", "@serve-tools/signals/collections"],
			["@serve-tools/signal-effect", "@serve-tools/signals", "@serve-tools/signals/effect"],
		],
		smokePath: "transfer/tasks/reactive-cart/smoke.mjs",
		hiddenPath: "transfer/tasks/reactive-cart/hidden.mjs",
		fixturePath: "transfer/tasks/reactive-cart/solution.fixture.ts",
		requirementMatrix: [
			row(
				"validation",
				"initial records, sparse arrays and every set/remove argument",
				"boundary",
				"smoke+hidden",
				"validation and atomicity tables",
				["cart-sparse-mutant"],
			),
			row(
				"snapshot",
				"sorting, amounts, subtotal, taxed membership and fresh nested data",
				"property",
				"smoke+hidden",
				"snapshot and seeded cart cases",
				["cart-tax-mutant"],
			),
			row(
				"updates",
				"insert, replace, no-op and remove return values",
				"interaction",
				"smoke+hidden",
				"mutation blocks",
				["cart-tax-mutant"],
			),
			row(
				"timing",
				"synchronous initial publish and microtask batching",
				"timing",
				"smoke+hidden",
				"publication timing blocks",
				["cart-dispose-mutant"],
			),
			row(
				"dispose",
				"queued cancellation, idempotence and post-dispose usability",
				"interaction",
				"hidden",
				"disposal lifecycle block",
				["cart-dispose-mutant"],
			),
		],
	},
	{
		id: "blob-channel",
		title: "Owned transferable blob MessageChannel",
		prompt: `Create a single solution.ts module that exports async openBlobChannel(initial = []).

Create a private Node-compatible MessageChannel, serve a typed protocol on one port, connect a client on the other, and await the handshake before resolving. initial is an iterable of [key, Uint8Array] pairs. Keys are non-empty strings. Values must be Uint8Array instances. Copy exactly each selected view's bytes; duplicate keys use the last value.

Return { put(key, value), get(key), subscribe(listener), close(reason?), closed }.

- put validates remotely, copies exactly the supplied view without detaching or later observing its backing buffer, stores it, increments version once, publishes stats, and resolves with the new version.
- get resolves to a fresh ArrayBuffer containing exactly the stored bytes, transferred from the serving side, or null when missing.
- subscribe returns the messaging subscription handle with idempotent unsubscribe() and Symbol.dispose. It emits current { count, bytes, version } immediately, then every successful put in order. count is stored key count; bytes is the sum of stored byte lengths. Each serving subscription cleanup runs once.
- close is idempotent, closes both protocol peers and both ports, terminates subscriptions, and prevents later requests from hanging. closed fulfills after both protocol peers close.

Version starts at 0. Invalid initial input rejects openBlobChannel with TypeError. Invalid put input rejects as a remote TypeError without changing state or publishing. Several subscribers are independent. Use the package's typed request/subscription, transfer, handshake, and disposal capabilities; do not use Web Locks or global navigator.`,
		packages: ["@serve-tools/client-messaging"],
		requiredRuntimeImports: [["@serve-tools/client-messaging", "@serve-tools/client-messaging/scope/window"]],
		smokePath: "transfer/tasks/blob-channel/smoke.mjs",
		hiddenPath: "transfer/tasks/blob-channel/hidden.mjs",
		fixturePath: "transfer/tasks/blob-channel/solution.fixture.ts",
		requirementMatrix: [
			row(
				"views",
				"initial and put Uint8Array boundary views",
				"boundary",
				"smoke+hidden",
				"copy/detachment and seeded byte cases",
				["blob-view-mutant"],
			),
			row(
				"requests",
				"put/get success, missing get, validation and remote error",
				"interaction",
				"smoke+hidden",
				"request behavior blocks",
				["blob-validation-mutant"],
			),
			row(
				"subscriptions",
				"immediate stats, ordered updates, several subscribers and one cleanup each",
				"interaction",
				"smoke+hidden",
				"subscription lifecycle blocks",
				["blob-duplicate-mutant"],
			),
			row(
				"ownership",
				"idempotent closure of peers, ports and subscriptions",
				"timing",
				"smoke+hidden",
				"close-with-pending-operations block",
				["blob-close-mutant"],
			),
		],
	},
	{
		id: "binary-packet",
		title: "Canonical binary packet",
		prompt: `Create a single solution.ts module that exports encodePacket(payload) and decodePacket(token).

payload must be a Uint8Array, including a subclass or Node Buffer. Encode exactly the selected view, not the whole backing buffer. The binary packet is one version byte equal to 1, followed by a four-byte unsigned big-endian payload length, followed by the payload bytes. Return canonical unpadded base64url text using the mutation-free Node Uint8Array base64 ponyfill. Empty payloads are valid. Reject payloads longer than 65535 bytes with TypeError.

decodePacket accepts only a string in canonical unpadded base64url spelling. Reject padding, standard-base64 characters, impossible/non-canonical encodings, packets shorter than five bytes, unsupported versions, declared lengths above 65535, and length mismatches with TypeError. Return a fresh Uint8Array containing only payload bytes; later mutation of the result must not affect another decode. Seeded byte values across base64 boundaries must round trip. Do not modify globals or built-in prototypes.`,
		packages: ["@serve-tools/ponyfill-arraybuffer-base64"],
		requiredRuntimeImports: [
			["@serve-tools/ponyfill-arraybuffer-base64", "@serve-tools/ponyfill-arraybuffer-base64/runtime/node"],
		],
		smokePath: "transfer/tasks/binary-packet/smoke.mjs",
		hiddenPath: "transfer/tasks/binary-packet/hidden.mjs",
		fixturePath: "transfer/tasks/binary-packet/solution.fixture.ts",
		requirementMatrix: [
			row(
				"wire",
				"version, unsigned big-endian length and payload",
				"example",
				"smoke+hidden",
				"wire-byte inspection blocks",
				["packet-endian-mutant"],
			),
			row(
				"views",
				"Uint8Array subclasses, Buffer and selected boundary views",
				"boundary",
				"smoke+hidden",
				"view and seeded round trips",
				["packet-endian-mutant"],
			),
			row(
				"canonical",
				"string type, alphabet, padding and canonical spelling",
				"property",
				"smoke+hidden",
				"encoding rejection table",
				["packet-canonical-mutant"],
			),
			row(
				"decode",
				"minimum size, versions, max/declared lengths, mismatch and fresh outputs",
				"boundary",
				"hidden",
				"packet structure table",
				["packet-length-mutant", "packet-version-mutant"],
			),
		],
	},
	{
		id: "resource-lease",
		title: "Deferred async resource lease",
		prompt: `Create a single solution.ts module that exports openResourceLease(acquire).

acquire receives a registrar with use(resource), adopt(value, dispose), and defer(dispose), and returns a value or promise. Registrations are owned by the mutation-free ponyfill's AsyncDisposableStack and package-scoped asyncDispose/dispose symbols. use accepts package-protocol async resources and package-protocol synchronous resources. adopt and defer cleanup callbacks may return promises.

On successful acquisition, resolve to { value, close, closed }. close() is idempotent, begins cleanup, and returns the exact same Promise object as closed. closed remains pending until close is called, then fulfills only after all cleanup completes or rejects with the cleanup failure. Cleanup runs once in exact reverse registration order. No cleanup occurs before close.

If acquisition throws or rejects, clean up every earlier registration before openResourceLease rejects. Preserve the exact acquisition and cleanup error identities. When acquisition plus cleanup fail, or multiple cleanups fail, expose the package's nested SuppressedError composition with later disposal failures outermost and the acquisition error at the deepest suppressed position. Reject invalid acquire values and invalid resources/callbacks with TypeError while still cleaning earlier registrations.

Do not consult native Symbol.dispose or Symbol.asyncDispose and do not modify globals.`,
		packages: ["@serve-tools/ponyfill-resource-management"],
		requiredRuntimeImports: [
			[
				"@serve-tools/ponyfill-resource-management",
				"@serve-tools/ponyfill-resource-management/lib/AsyncDisposableStack",
			],
		],
		smokePath: "transfer/tasks/resource-lease/smoke.mjs",
		hiddenPath: "transfer/tasks/resource-lease/hidden.mjs",
		fixturePath: "transfer/tasks/resource-lease/solution.fixture.ts",
		requirementMatrix: [
			row(
				"lease",
				"successful sync/async acquisition, pending closed and exact close promise",
				"timing",
				"smoke+hidden",
				"lease timing blocks",
				["lease-rollback-mutant"],
			),
			row(
				"cleanup",
				"use/adopt/defer, package symbols, reverse async order and once-only close",
				"interaction",
				"smoke+hidden",
				"cleanup order blocks",
				["lease-rollback-mutant"],
			),
			row(
				"acquire-failure",
				"sync/rejected acquisition and invalid registration after earlier resources",
				"identity",
				"smoke+hidden",
				"rollback blocks",
				["lease-rollback-mutant"],
			),
			row(
				"composition",
				"acquisition and one/several cleanup failures",
				"identity",
				"smoke+hidden",
				"nested SuppressedError tree blocks",
				["lease-suppression-mutant"],
			),
		],
	},
	{
		id: "switchable-projection",
		title: "Restartable dormant projection",
		prompt: `Create a single solution.ts module that exports createSwitchableProjection(initial, publish).

initial is { items, offset, limit, enabled }. items must be a dense iterable of finite numbers; sparse arrays are invalid. offset and limit are non-negative safe integers. enabled is boolean. Validate initial and every setter before changing state; invalid values, including null, throw TypeError without partial mutation. Copy item inputs.

Return { setItems(items), setWindow(offset, limit), setEnabled(enabled), start(), stop(), snapshot(), dispose() }. snapshot returns a fresh array: when enabled, take the current items slice from offset through offset + limit, multiply each value by its one-based position within that window, and retain order; when disabled return [].

start() is idempotent while active. Unless permanently disposed, each transition from stopped to active synchronously publishes the current snapshot and begins tracking only state read by the projection. Later effective changes are batched to at most one publish per microtask. stop() is idempotent, cancels a queued publication, and permits a later start. While stopped, changes do not publish. While active and disabled, item/window changes do not queue a publish; enabling publishes the latest values. stop followed by start in the same turn publishes only the synchronous restart snapshot and leaves no stale queued publish.

dispose() permanently stops and is idempotent. Start after disposal does nothing. Mutations and snapshot remain usable. Published arrays stay isolated. Use signal-aware array/object state and a newly dormant signal-effect controller for each activation.`,
		packages: ["@serve-tools/signal", "@serve-tools/signal-collections", "@serve-tools/signal-effect"],
		requiredRuntimeImports: [
			["@serve-tools/signal-collections", "@serve-tools/signals", "@serve-tools/signals/collections"],
			["@serve-tools/signal-effect", "@serve-tools/signals", "@serve-tools/signals/effect"],
		],
		smokePath: "transfer/tasks/switchable-projection/smoke.mjs",
		hiddenPath: "transfer/tasks/switchable-projection/hidden.mjs",
		fixturePath: "transfer/tasks/switchable-projection/solution.fixture.ts",
		requirementMatrix: [
			row(
				"validation",
				"dense finite items, offset/limit, enabled, null and atomic setters",
				"boundary",
				"smoke+hidden",
				"validation tables",
				["projection-sparse-mutant"],
			),
			row(
				"projection",
				"offset/limit, one-based weighting, disabled state and fresh arrays",
				"property",
				"smoke+hidden",
				"snapshot and seeded window cases",
				["projection-disabled-mutant"],
			),
			row(
				"active",
				"synchronous start, idempotence, dependency-sensitive microtask batching",
				"timing",
				"smoke+hidden",
				"active timing blocks",
				["projection-disabled-mutant"],
			),
			row(
				"restart",
				"stop cancellation, later start and same-turn stale queue prevention",
				"interaction",
				"smoke+hidden",
				"restart lifecycle blocks",
				["projection-restart-mutant"],
			),
			row(
				"dispose",
				"permanent idempotent stop and post-dispose usable state",
				"interaction",
				"hidden",
				"disposal block",
				["projection-dispose-mutant"],
			),
		],
	},
];

function row(requirement, disclosedInputs, oracle, visibility, testBlock, mutantIds) {
	const critical = new Set([
		"success",
		"failure",
		"ownership",
		"backpressure",
		"methods",
		"initial",
		"snapshot",
		"updates",
		"timing",
		"dispose",
		"views",
		"requests",
		"subscriptions",
		"lease",
		"cleanup",
		"acquire-failure",
		"composition",
		"projection",
		"active",
		"restart",
	]).has(requirement);

	return { requirement, disclosedInputs, oracle, visibility, testBlock, mutantIds, critical };
}
