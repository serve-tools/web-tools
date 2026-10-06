const capabilities = {
	context: [
		"Share component context",
		"Provide values to nested web components, including consumers registered later.",
		"ui",
		"context provider consumer theme dependency injection",
	],
	db: [
		"Use IndexedDB with promises",
		"Read, write, transact, and scan records without wiring request events.",
		"data",
		"database indexeddb offline persistence transactions cursor",
	],
	"dom-fragment": [
		"Reuse DOM fragments",
		"Hide and restore the same nodes while preserving their identity and state.",
		"ui",
		"conditional visibility persistent nodes fragment",
	],
	"event-source": [
		"Receive typed server events",
		"Listen to named JSON events through the browser's native EventSource.",
		"communication",
		"sse server sent events live updates",
	],
	"http-stream": [
		"Request & stream over HTTP",
		"Call typed binary operations and consume streamed subscription updates with Fetch.",
		"communication",
		"fetch streaming binary subscriptions realtime",
	],
	input: [
		"Observe pointer & drop sessions",
		"Handle pointer gestures and drag-and-drop with explicit cancellation.",
		"interaction",
		"drag drop mouse touch pen gesture abort",
	],
	interaction: [
		"Use native browser interactions",
		"Open pickers, copy to the clipboard, share, and sample colors with explicit outcomes.",
		"interaction",
		"clipboard file picker share eyedropper color",
	],
	keyboard: [
		"Make shortcuts platform-aware",
		"Match keyboard chords and generate labels, symbols, and ARIA shortcuts.",
		"interaction",
		"keyboard shortcut hotkey mac windows accessibility",
	],
	messaging: [
		"Call workers with typed messages",
		"Make requests and subscribe to updates across workers and message ports.",
		"communication",
		"worker postmessage rpc messagechannel shared worker cross tab",
	],
	router: [
		"Navigate with typed routes",
		"Connect route declarations to native browser navigation and View Transitions.",
		"routing",
		"navigation url history links spa view transitions",
	],
	"shared-db": [
		"Coordinate a database across tabs",
		"Let a SharedWorker coordinate IndexedDB operations and committed-change subscriptions.",
		"data",
		"database indexeddb sharedworker cross tab multi window changes",
	],
	"shared-event-source": [
		"Share one EventSource across tabs",
		"Let a SharedWorker own one native EventSource for several pages.",
		"communication",
		"sse sharedworker cross tab multi window connection",
	],
	"shared-http-stream": [
		"Coordinate HTTP streams across tabs",
		"Use typed HTTP operations through a SharedWorker-owned client.",
		"communication",
		"fetch binary streaming sharedworker cross tab multi window",
	],
	"shared-websocket": [
		"Share one WebSocket across tabs",
		"Keep typed requests and subscriptions while a SharedWorker owns the physical socket.",
		"communication",
		"websocket sharedworker cross tab multi window connection",
	],
	"shared-webtransport": [
		"Share WebTransport across tabs",
		"Use requests, subscriptions, and datagrams through a SharedWorker-owned session.",
		"communication",
		"http3 datagrams sharedworker cross tab multi window",
	],
	storage: [
		"Observe persistent settings",
		"Read and write typed Web Storage values and subscribe to changes.",
		"data",
		"localstorage sessionstorage preferences settings theme cross tab",
	],
	websocket: [
		"Use typed WebSocket operations",
		"Make requests and subscribe to live updates with structured and binary values.",
		"communication",
		"websocket realtime rpc binary map date typed array",
	],
	webtransport: [
		"Use WebTransport operations",
		"Combine typed requests and subscriptions with best-effort datagrams.",
		"communication",
		"http3 realtime datagrams binary low latency",
	],
	dom: [
		"Render reactive DOM",
		"Bind Signals to DOM, SVG, and MathML so existing nodes update with state.",
		"ui",
		"render template html svg mathml reactive",
	],
	"event-target": [
		"Read events as Signal state",
		"Observe EventTarget state and media queries through read-only Signals.",
		"ui",
		"events matchmedia media query resize reactive",
	],
};

const platformCapabilities = {
	"arraybuffer-base64": [
		"Encode bytes as base64",
		"Encode Uint8Array data with the package's documented base64 API.",
		"base64 binary bytes uint8array node",
	],
	composites: [
		"Use composite value keys",
		"Intern shallow named-value keys so equivalent field groups share identity.",
		"composite equality structured map key proposal",
	],
	"custom-element-registry": [
		"Scope custom element definitions",
		"Explore the documented iframe-backed fallback for scoped custom element registries.",
		"web components scoped registry firefox experimental iframe",
	],
	"decorator-metadata": [
		"Supply decorator metadata",
		"Provide a shared Symbol.metadata key for producers and consumers.",
		"decorators symbol metadata",
	],
	observable: [
		"Consume observable streams",
		"Compose streams using the package's documented Observable subset.",
		"observable events stream filter map abort",
	],
	"prioritized-task-scheduling": [
		"Schedule prioritized work",
		"Use scheduler tasks and cancellation with the documented fallback behavior.",
		"scheduler posttask yield priority taskcontroller",
	],
	"report-error": [
		"Report asynchronous errors",
		"Use reportError with the package's documented fallback behavior.",
		"error reporting console exception",
	],
	"request-idle-callback": [
		"Schedule idle work",
		"Run background work through requestIdleCallback and cancel it when needed.",
		"idle background scheduling deadline",
	],
	"resource-management": [
		"Manage resource cleanup",
		"Supply the runtime APIs for explicit disposal; syntax support is separate.",
		"using await using disposable stack cleanup",
	],
	urlpattern: [
		"Match URL patterns",
		"Extract URL components and named groups through URLPattern.",
		"url pattern route pathname matching",
	],
};

const reactiveCapabilities = {
	db: ["Watch IndexedDB queries", "Refresh reactive query state after committed writes through the same connection."],
	dom: ["Render reactive DOM", "Bind Signals to DOM, SVG, and MathML so existing nodes update with state."],
	"event-source": ["Read latest server events", "Observe the latest typed JSON event through Signal state."],
	"event-target": [
		"Observe events as Signal state",
		"Read EventTarget state and media queries through read-only Signals.",
	],
	"http-stream": [
		"Observe HTTP stream updates",
		"Keep typed HTTP operations and read subscription updates through Signals.",
	],
	messaging: [
		"Observe worker updates",
		"Keep typed worker requests and consume subscription updates through Signals.",
	],
	"shared-db": [
		"Watch shared database queries",
		"Coordinate committed changes across tabs and refresh reactive queries.",
	],
	"shared-event-source": [
		"Observe shared server events",
		"Read latest-event Signals while a SharedWorker owns one EventSource.",
	],
	"shared-http-stream": [
		"Observe shared HTTP streams",
		"Read subscription Signals through a SharedWorker-owned HTTP client.",
	],
	"shared-websocket": [
		"Observe a shared WebSocket",
		"Read subscription Signals while several tabs share one physical socket.",
	],
	"shared-webtransport": [
		"Observe shared WebTransport",
		"Read subscription Signals through a SharedWorker-owned session.",
	],
	storage: [
		"Watch persistent settings",
		"Use saved Web Storage values as reactive inputs to computed state and views.",
	],
	websocket: [
		"Observe WebSocket subscriptions",
		"Keep typed requests and read live subscription state through Signals.",
	],
	webtransport: [
		"Observe WebTransport updates",
		"Combine typed operations and datagrams with subscription Signal state.",
	],
};

const special = {
	"components/base": [
		"Compose native web components",
		"Build interfaces from components with native platform behavior and owned Signal lifetimes.",
		"ui",
		"Browser · private preview",
		"components forms dialog menu accessibility",
	],
	"core/async-operation": [
		"Track progress & a final result",
		"Own cancellable asynchronous work with a value stream and a terminal result.",
		"communication",
		"Runtime-neutral",
		"async operation progress cancellation result",
	],
	"core/http-contract": [
		"Declare a JSON HTTP API once",
		"Validate requests and responses on the server, then call the typed API with native Fetch.",
		"routing",
		"Browser & server",
		"http json fetch validation standard schema openapi",
	],
	"core/router": [
		"Generate & parse typed URLs",
		"Share route declarations across runtimes, with typed parameters and search values.",
		"routing",
		"Runtime-neutral",
		"url route links params query codecs",
	],
	"lit/signals": [
		"Use Signals in Lit templates",
		"Bind reactive values to Lit templates, styles, directives, and decorators.",
		"ui",
		"Browser · Lit",
		"lit template reactive signals",
	],
	"signals/signal": [
		"Build reactive state",
		"Create State and lazy Computed values with a proposal-aligned Signal runtime.",
		"ui",
		"Runtime-neutral",
		"state computed reactive tc39 proposal",
	],
	"signals/effect": [
		"React to Signal changes",
		"Run an effect immediately, then batch later updates onto a microtask.",
		"ui",
		"Runtime-neutral",
		"effect reactive microtask batching cleanup",
	],
	"signals/collections": [
		"Make collections reactive",
		"Use familiar Array, Map, Set, and Object operations with tracked Signal reads.",
		"ui",
		"Runtime-neutral",
		"array map set object collection reactive",
	],
	"rolldown/decorators": [
		"Build with modern decorators",
		"Transform TC39 decorator syntax and semantics in Rolldown and Vite.",
		"build",
		"Rolldown & Vite",
		"decorators transform compile vite",
	],
	"rolldown/typescript": [
		"Type-check during development",
		"Compile and check supported TypeScript inputs through the in-memory build integration.",
		"build",
		"Rolldown & Vite",
		"typescript compiler errors development",
	],
	"vite/polyfills": [
		"Let the build select polyfills",
		"Detect supported feature usage and inject configured browser compatibility code.",
		"build",
		"Vite",
		"browser compatibility polyfill automatic inject",
	],
	suite: [
		"Guide your coding agent",
		"Install package-selection guidance and explicitly activate it in a trusted Skill directory.",
		"build",
		"Authoring tools",
		"agent skill discovery guidance",
	],
};

export const combinedPackages = {
	"@serve-tools/client": {
		title: "Client tools together",
		description: "Namespaced browser capabilities, also available through focused subpaths.",
	},
	"@serve-tools/client-signals": {
		title: "Signal clients together",
		description: "Namespaced reactive clients, also available through focused subpaths.",
	},
	"@serve-tools/signals": {
		title: "Signal primitives together",
		description: "Signal state, effects, and collections through one flat export surface.",
	},
};

/** Builds an explicit discovery record; an unclassified public package fails the docs build. */
export function describePackage({ name, location }) {
	const [group, capability] = location.split("/");
	const combined = combinedPackages[name];
	if (combined) {
		return {
			...combined,
			task: group === "client" ? "communication" : "ui",
			environment: "Combined package",
			kind: "combined",
			keywords: "bundle combined package several capabilities",
		};
	}
	const details = special[location];
	if (details) {
		const [title, description, task, environment, keywords] = details;
		return {
			title,
			description,
			task,
			environment,
			keywords,
			kind: location === "suite" ? "authoring" : "capability",
		};
	}
	if (group === "polyfills" || group === "ponyfills") {
		const details = platformCapabilities[capability];
		if (details) {
			const [title, description, keywords] = details;
			return {
				title,
				description,
				keywords,
				task: "platform",
				environment: group === "polyfills" ? "Native-aware / global compatibility" : "Explicit fallback import",
				kind: "capability",
			};
		}
	}
	if (["client", "client-signals", "server"].includes(group)) {
		if (capability === "realtime") {
			return {
				title: `Build a ${group === "server" ? "server" : "client"} transport adapter`,
				description: "Use the transport-neutral core when implementing another realtime transport.",
				task: "communication",
				environment: group === "server" ? "Server" : "Browser",
				kind: "foundation",
				keywords: "advanced adapter sans io transport integration",
			};
		}
		const details = capabilities[capability];
		if (details) {
			let [title, description, task, keywords] = details;
			if (group === "client-signals") {
				[title, description] = reactiveCapabilities[capability];
			}
			if (group === "server") {
				title =
					capability === "event-source"
						? "Send JSON server events"
						: `Serve typed ${capability === "http-stream" ? "HTTP streaming" : capability === "websocket" ? "WebSocket" : "WebTransport"} operations`;
				description =
					capability === "event-source"
						? "Return JSON Server-Sent Events from a Fetch-compatible handler."
						: "Handle typed requests and streaming subscriptions with the matching client transport.";
			}
			return {
				title,
				description,
				task,
				keywords,
				environment: group === "server" ? "Server" : "Browser",
				kind: "capability",
			};
		}
	}
	if (location === "realtime/protocol") {
		return {
			title: "Encode realtime protocol values",
			description: "Use structured binary values and wire messages for transport integration.",
			task: "communication",
			environment: "Runtime-neutral",
			kind: "foundation",
			keywords: "advanced binary structured cyclic graph map typed array protocol adapter",
		};
	}
	throw new Error(`Missing catalog guidance for ${name} (${location})`);
}

/** Combined-package membership is derived from direct package dependencies, never its folder. */
export function combinedMembers(workspace, libraries) {
	if (!combinedPackages[workspace.name]) {
		return [];
	}
	const dependencies = Object.keys(workspace.manifest.dependencies ?? {});
	for (const dependency of dependencies) {
		if (dependency.startsWith("@serve-tools/") && !libraries.some((entry) => entry.name === dependency)) {
			throw new Error(`${workspace.name} includes an undocumented package: ${dependency}`);
		}
	}
	return libraries.filter((entry) => dependencies.includes(entry.name)).map((entry) => entry.name);
}

/** Returns nearby alternatives without treating every dependency as an application choice. */
export function relatedPackages(entry, packages) {
	const candidates = [];
	const name = entry.name;
	if (name.startsWith("@serve-tools/client-")) {
		candidates.push(name.replace("@serve-tools/client-", "@serve-tools/signal-"));
	}
	if (name.startsWith("@serve-tools/signal-") && entry.location.startsWith("client-signals/")) {
		candidates.push(name.replace("@serve-tools/signal-", "@serve-tools/client-"));
	}
	if (name.startsWith("@serve-tools/polyfill-")) {
		candidates.push(name.replace("polyfill-", "ponyfill-"));
	}
	if (name.startsWith("@serve-tools/ponyfill-")) {
		candidates.push(name.replace("ponyfill-", "polyfill-"));
	}
	if (/\/(?:event-source|http-stream|websocket|webtransport)$/.test(entry.location)) {
		const capability = entry.location.split("/")[1];
		candidates.push(`@serve-tools/${entry.location.startsWith("server/") ? "client" : "server"}-${capability}`);
	}
	if (entry.kind === "foundation") {
		candidates.push("@serve-tools/client-websocket", "@serve-tools/server-websocket");
	}
	return packages.filter((other) => candidates.includes(other.name) || other.members.includes(name));
}
