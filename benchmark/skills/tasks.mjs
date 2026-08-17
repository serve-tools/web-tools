const selections = [
	[
		"context-provider-replay",
		"Components outside Lit need typed DOM context providers and consumers. A consumer may connect before its provider, and it must receive late registrations and subsequent values.",
		"@serve-tools/client-context",
	],
	[
		"indexeddb-direct-operations",
		"Build a typed browser repository over IndexedDB with direct Promise-based transactions and scans. It does not need cross-tab coordination or reactive reads.",
		"@serve-tools/client-db",
	],
	[
		"pointer-drag-session",
		"Track pointer and drag-and-drop sessions for a canvas tool, with explicit ownership of listeners and cancellation when the interaction ends.",
		"@serve-tools/client-input",
	],
	[
		"clipboard-and-picker",
		"Implement one-shot clipboard, file picker, share, and eyedropper actions while preserving cancellation and unsupported-platform outcomes.",
		"@serve-tools/client-interaction",
	],
	[
		"keyboard-shortcuts",
		"Match cross-platform keyboard chords and produce both visible shortcut symbols and accessible aria-keyshortcuts values.",
		"@serve-tools/client-keyboard",
	],
	[
		"worker-request-stream",
		"Define typed finite requests and streaming subscriptions between a window and a worker over MessagePort, including transferable buffers.",
		"@serve-tools/client-messaging",
	],
	[
		"custom-realtime-client-core",
		"Adapt a custom full-duplex transport to typed realtime requests and subscriptions without owning a WebSocket, WebTransport session, or HTTP stream exchange.",
		"@serve-tools/client-realtime",
	],
	[
		"http-stream-client",
		"Call typed finite operations and consume framed binary subscription streams through Fetch, including authorization headers and AbortSignal cancellation.",
		"@serve-tools/client-http-stream",
	],
	[
		"shared-worker-indexeddb",
		"Coordinate typed IndexedDB writes and change subscriptions across browser tabs through one SharedWorker. Promise results are sufficient.",
		"@serve-tools/client-shared-db",
	],
	[
		"shared-worker-websocket",
		"Share one typed WebSocket connection across several browser tabs while keeping requests, subscriptions, cancellation, and per-tab cleanup explicit.",
		"@serve-tools/client-shared-websocket",
	],
	[
		"observable-web-storage",
		"Read, write, remove, and observe typed localStorage preferences, including same-document changes and cancellation. The consumer is imperative rather than Signal-based.",
		"@serve-tools/client-storage",
	],
	[
		"binary-websocket-protocol",
		"Own a browser WebSocket that carries structured binary values and exposes typed named requests plus long-lived subscriptions with cancellation.",
		"@serve-tools/client-websocket",
	],
	[
		"webtransport-realtime-client",
		"Own a WebTransport session with typed reliable requests and subscriptions plus named typed datagrams for transient state.",
		"@serve-tools/client-webtransport",
	],
	[
		"custom-realtime-server-core",
		"Adapt a custom transport to typed realtime handlers, cancellation, backpressure, and connection cleanup without owning a network runtime.",
		"@serve-tools/server-realtime",
	],
	[
		"http-stream-server",
		"Serve typed finite responses and framed binary subscriptions from WHATWG Request objects, authorizing before decoding and returning negotiated Fetch responses.",
		"@serve-tools/server-http-stream",
	],
	[
		"binary-websocket-server",
		"Serve typed binary WebSocket requests and subscriptions from Node.js, authenticating during the HTTP upgrade and passing identity into cancellable handlers.",
		"@serve-tools/server-websocket",
	],
	[
		"webtransport-realtime-server",
		"Serve typed WebTransport sessions with reliable operations and named typed datagrams through a sans-I/O core or the Node HTTP/3 adapter.",
		"@serve-tools/server-webtransport",
	],
	[
		"realtime-stream-wire-format",
		"Build custom reliable byte-stream transport glue with the shared structured serializer, versioned message guards, and incremental length-prefix framing. Do not own application socket lifecycle.",
		"@serve-tools/realtime-protocol",
	],
	[
		"functional-signal-dom",
		"Render HTML, SVG, and MathML directly from Signals without adopting Lit or a component base class.",
		"@serve-tools/signal-dom",
	],
	[
		"media-query-signal",
		"Expose MediaQueryList.matches and other EventTarget-backed current state as read-only Signals with explicit disposal.",
		"@serve-tools/signal-event-target",
	],
	[
		"worker-subscription-signal",
		"A worker subscription already uses the typed messaging protocol. Present its current pending, ready, and error state as a Signal to UI consumers.",
		"@serve-tools/signal-messaging",
	],
	[
		"shared-query-signal",
		"A SharedWorker owns IndexedDB. UI code needs a query that reactively refreshes when relevant records change and exposes explicit loading/error/ready states.",
		"@serve-tools/signal-shared-db",
	],
	[
		"websocket-subscription-signal",
		"A typed WebSocket subscription should be consumed by UI code as current pending, ready, complete, or error Signal state.",
		"@serve-tools/signal-websocket",
	],
	[
		"shared-websocket-subscription-signal",
		"A SharedWorker-owned WebSocket subscription should be exposed to each page as disposable current Signal state.",
		"@serve-tools/signal-shared-websocket",
	],
	[
		"storage-value-signal",
		"Expose one typed localStorage preference as disposable Signal state and update the document when that preference changes.",
		"@serve-tools/signal-storage",
	],
	[
		"lit-signal-binding",
		"Build Lit elements whose templates, decorators, host styles, and lifecycle tracking consume TC39 Signals without replacing Lit.",
		"@serve-tools/lit-signals",
	],
	[
		"reactive-map",
		"Use Map and Set shaped collections whose key, value, presence, and iteration reads participate in Signal dependency tracking.",
		"@serve-tools/signal-collections",
	],
	[
		"batched-effect",
		"Run a side effect from Signal dependencies, batch reruns in a microtask, and stop it explicitly during cleanup.",
		"@serve-tools/signal-effect",
	],
	[
		"tc39-signal-primitives",
		"Use the core TC39 Signals State, Computed, and Watcher primitives without DOM, Lit, storage, or transport integration.",
		"@serve-tools/signal",
	],
	[
		"idle-callback-global",
		"Legacy third-party code calls globalThis.requestIdleCallback directly. Install compatible globals when the browser lacks them.",
		"@serve-tools/polyfill-request-idle-callback",
	],
	[
		"arraybuffer-base64-global",
		"Server-side code expects Uint8Array.prototype.toBase64. Install the proposal-compatible method in Node.js without changing browser bundles.",
		"@serve-tools/polyfill-arraybuffer-base64",
	],
	[
		"idle-callback-import",
		"Schedule optional work with imported requestIdleCallback functions while guaranteeing that no globals are modified.",
		"@serve-tools/ponyfill-request-idle-callback",
	],
	[
		"arraybuffer-base64-import",
		"Encode Uint8Array values as base64 or base64url in Node.js through an explicit import without modifying Uint8Array.prototype.",
		"@serve-tools/ponyfill-arraybuffer-base64",
	],
	[
		"resource-management-global",
		"Third-party modules expect DisposableStack, AsyncDisposableStack, and related explicit-resource-management globals to exist.",
		"@serve-tools/polyfill-resource-management",
	],
	[
		"resource-management-import",
		"Use DisposableStack and AsyncDisposableStack through explicit imports without modifying globalThis or depending on global constructor identity.",
		"@serve-tools/ponyfill-resource-management",
	],
	[
		"vite-target-polyfills",
		"A Vite build should inspect source usage and configured browser targets, then inject only the required feature polyfills.",
		"@serve-tools/vite-polyfills",
	],
	[
		"client-namespace-facade",
		"One application shell intentionally exposes database, storage, messaging, input, and interaction utilities through a single namespace-oriented import surface.",
		"@serve-tools/client",
	],
	[
		"client-signals-namespace-facade",
		"One application shell intentionally exposes several signal-aware browser integrations through a single namespace-oriented import surface.",
		"@serve-tools/client-signals",
	],
];

const selectionTasks = selections.map(([id, prompt, packageName]) => ({
	expected: { packages: [packageName] },
	id,
	kind: "selection",
	prompt,
	source: "suite-contract",
}));

const compositionTasks = [
	{
		expected: {
			answerTerms: ["worker", "signal", "dispose", "close"],
			documentSuffixes: ["split-responsibilities-correctly.md", "choose-promise-or-signal-semantics.md"],
			packages: ["@serve-tools/client-shared-db", "@serve-tools/signal-shared-db"],
		},
		fixtureAnswer:
			"Let @serve-tools/client-shared-db own the worker connection and Promise operations, then adapt reactive queries with @serve-tools/signal-shared-db. Dispose each query Signal before you close the database client.",
		id: "reactive-cross-tab-database",
		kind: "composition",
		prompt: "Design the smallest package combination for a Lit application with IndexedDB coordinated through a SharedWorker. Mutations are awaited, while selected queries must update as Signal state across tabs. Explain ownership and cleanup.",
		source: "common-architecture",
	},
	{
		expected: {
			answerTerms: ["request", "subscription", "signal", "dispose"],
			documentSuffixes: ["model-the-protocol.md", "choose-occurrences-or-state.md"],
			packages: ["@serve-tools/client-messaging", "@serve-tools/signal-messaging"],
		},
		fixtureAnswer:
			"Model finite requests and occurrence subscriptions with @serve-tools/client-messaging. Use @serve-tools/signal-messaging only for subscriptions consumed as current Signal state, and dispose the Signal and transport owners.",
		id: "reactive-worker-messaging",
		kind: "composition",
		prompt: "A worker protocol has finite commands and progress subscriptions. Service code awaits commands, but a Lit view needs current progress as reactive state. Choose packages and preserve the difference between occurrences and state.",
		source: "common-architecture",
	},
	{
		expected: {
			answerTerms: ["lit", "map", "signal", "lifecycle"],
			documentSuffixes: ["compose-fine-grained-and-component-updates.md", "render-collections-with-lit.md"],
			packages: ["@serve-tools/lit-signals", "@serve-tools/signal-collections"],
		},
		fixtureAnswer:
			"Use @serve-tools/lit-signals for Lit lifecycle-aware bindings and @serve-tools/signal-collections for the reactive Map. Read the collection through a Lit Signal binding so component lifecycle owns observation.",
		id: "lit-reactive-collection",
		kind: "composition",
		prompt: "A Lit component renders a frequently edited Map of upload records. Reads of individual keys and iteration should be reactive without cloning the Map, and observation must stop with the component lifecycle.",
		source: "reve-core-inspired",
	},
	{
		expected: {
			answerTerms: ["storage", "signal", "dispose"],
			documentSuffixes: ["preserve-observation-semantics.md", "preserve-source-semantics.md"],
			packages: ["@serve-tools/client-storage", "@serve-tools/signal-storage"],
		},
		fixtureAnswer:
			"Use @serve-tools/client-storage for typed mutations and observation semantics, and @serve-tools/signal-storage where UI consumers require current Signal state. Dispose watched Signals when their owner ends.",
		id: "reactive-preference-storage",
		kind: "composition",
		prompt: "Replace scattered localStorage preference reads with typed writes plus reactive UI consumption. Same-document changes must be observed and each view must release its watcher.",
		source: "reve-core-inspired",
	},
	{
		expected: {
			answerTerms: ["vite", "detect", "inject", "global"],
			documentSuffixes: ["configure-the-plugin.md"],
			packages: ["@serve-tools/vite-polyfills"],
		},
		fixtureAnswer:
			"Configure @serve-tools/vite-polyfills so Vite detects used features and injects required global polyfills for the selected targets. Do not manually import every runtime polyfill package.",
		id: "build-owned-polyfills",
		kind: "composition",
		prompt: "An application targets several browser generations. The build should inspect feature use and inject compatibility code, rather than asking every module to choose ponyfills or globally importing every fallback.",
		source: "common-architecture",
	},
	{
		expected: {
			answerTerms: ["context", "lit", "provider", "lifecycle"],
			documentSuffixes: ["preserve-identity-and-selection.md", "preserve-lifecycle-and-runtime-identity.md"],
			packages: ["@serve-tools/client-context", "@serve-tools/lit-signals"],
		},
		fixtureAnswer:
			"Use @serve-tools/client-context for the interoperable provider/consumer protocol and @serve-tools/lit-signals for Signal-aware Lit lifecycle integration. Preserve context identity and connect or disconnect each provider with its host lifecycle.",
		id: "context-backed-lit-state",
		kind: "composition",
		prompt: "Share typed application state through DOM context across independently mounted component trees, then consume reactive values inside Lit components. Late providers and host lifecycle both matter.",
		source: "reve-core-inspired",
	},
];

const usageTasks = [
	usage(
		"typed-websocket-client",
		"Implement a typed WebSocket client with an authenticate request, a messages subscription, AbortSignal cancellation, protocol extraction, and deterministic connection disposal.",
		["@serve-tools/client-websocket"],
		"client/websocket/test/client-websocket.recipes.ts",
		["connect<", ".request(", ".subscribe(", "ProtocolType", "await using"],
		["client/websocket/skills/serve-tools-client-websocket/references/recipe-quick-start.md"],
	),
	usage(
		"typed-worker-protocol",
		"Implement both sides of a typed MessagePort protocol with one ArrayBuffer request, one progress subscription, transfer ownership of the buffer, propagate cancellation, and dispose server and client resources.",
		["@serve-tools/client-messaging"],
		"client/messaging/test/client-messaging.recipes.ts",
		["satisfies Handlers", "transfer(", "serve<", "connect<", ".subscribe(", ".request("],
		["client/messaging/skills/serve-tools-client-messaging/references/recipe-quick-start.md"],
	),
	usage(
		"observable-preferences",
		"Create typed preference storage, observe color-scheme changes including removed or invalidated values, cancel observation with an AbortSignal, and write a new preference.",
		["@serve-tools/client-storage"],
		"client/storage/test/client-storage.recipes.ts",
		["new Storage<", ".subscribe(", "invalidated", "{ signal }", ".set("],
		["client/storage/skills/serve-tools-client-storage/references/recipe-quick-start.md"],
	),
	usage(
		"reactive-storage-theme",
		"Implement a typed localStorage-backed theme Signal, apply its current value to the document, and release the reactive watch when its owner is done.",
		["@serve-tools/signal-storage"],
		"client-signals/storage/test/signal-storage.recipes.ts",
		["new SignalStorage<", ".watch(", ".get()", ".dispose()"],
		[
			"client-signals/storage/skills/serve-tools-signal-storage/references/recipe-quick-start.md",
			"own-the-lifecycle.md",
		],
	),
	usage(
		"lit-signal-counter",
		"Create a custom Lit counter element backed by Signal.State. Import the compatible Signal re-export from the Lit integration package, bind the count through its fine-grained template helper, and update it from a click handler.",
		["@serve-tools/lit-signals"],
		"lit/signals/test/lit-signals.recipes.ts",
		["extends LitElement", "new Signal.State", "html`", "watch("],
		["lit/signals/skills/serve-tools-lit-signals/references/recipe-quick-start.md"],
	),
	usage(
		"reactive-map-filter",
		"Use a signal-aware Map and object-shaped filter, then derive the selected user's name with Signal.Computed without cloning the collection.",
		["@serve-tools/signal-collections", "@serve-tools/signal"],
		"signals/collections/test/signal-collections.recipes.ts",
		["new SignalMap", "new SignalObject", "new Signal.Computed"],
		["signals/collections/skills/serve-tools-signal-collections/references/recipe-quick-start.md"],
	),
	usage(
		"batched-signal-effects",
		"Create one immediately active Signal effect and one explicitly started effect. Update their dependency, then stop and dispose both owners.",
		["@serve-tools/signal-effect", "@serve-tools/signal"],
		"signals/effect/test/signal-effect.recipes.ts",
		["effect(", "createEffect(", ".start()", ".dispose()"],
		["signals/effect/skills/serve-tools-signal-effect/references/recipe-quick-start.md"],
	),
	usage(
		"custom-vite-polyfill",
		"Define a Vite polyfill detected from an AST member expression, combine it with builtin polyfills, and export the configured plugin.",
		["@serve-tools/vite-polyfills"],
		"vite/polyfills/test/vite-polyfills.recipes.ts",
		["definePolyfill(", "MemberExpression", "builtinPolyfills", "vitePolyfills("],
		["vite/polyfills/skills/serve-tools-vite-polyfills/references/recipe-quick-start.md"],
	),
];

export const tasks = [...selectionTasks, ...compositionTasks, ...usageTasks];

function usage(id, prompt, packages, goldenRecipe, codeTerms, documentSuffixes, allowedImports = []) {
	return {
		expected: { allowedImports, codeTerms, documentSuffixes, packages },
		goldenRecipe,
		id,
		kind: "usage",
		prompt,
		source: id.includes("storage") || id.includes("lit") ? "reve-core-inspired" : "package-contract",
	};
}
