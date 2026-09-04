// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Prompts and mutation literals contain TypeScript source text.

const row = (id, description, critical = true) => ({ id, description, critical });

const task = (id, family, title, prompt, packages, requiredRuntimeImports, requirements, mutants) => ({
	id,
	family,
	title,
	prompt: `Create a single solution.ts module that exports ${prompt}`,
	packages,
	requiredRuntimeImports,
	smokePath: `ablation/tasks/${id}/smoke.mjs`,
	hiddenPath: `ablation/tasks/${id}/hidden.mjs`,
	fixturePath: `ablation/tasks/${id}/solution.fixture.ts`,
	requirementMatrix: requirements.map(([id, description, critical = true]) => row(id, description, critical)),
	mutants: mutants.map(([id, before, after, requirementIds]) => ({ id, before, after, requirementIds })),
});

export const tasksB = [
	task(
		"base64-selected-view",
		"arraybuffer-base64",
		"Encode an exact typed-array slice",
		'encodeSlice(bytes, start, end, alphabet). bytes must be a Uint8Array, including a Buffer or subclass. start and end must be safe integers satisfying 0 <= start <= end <= bytes.byteLength, and alphabet must be exactly "base64" or "base64url"; throw TypeError for any invalid argument. Encode exactly bytes.subarray(start, end), preserving the input view\'s byteOffset and leaving it unchanged, through toBase64 from the package\'s Node runtime. Return a string: standard base64 retains padding and base64url is URL-safe and omits padding. Empty slices are valid. Do not modify globals.',
		["@serve-tools/ponyfill-arraybuffer-base64"],
		[["@serve-tools/ponyfill-arraybuffer-base64/runtime/node"]],
		[
			["view", "honor the input view offset and validated selected bounds"],
			["alphabet", "return padded base64 or unpadded base64url"],
		],
		[
			[
				"wrong-view-offset",
				"return toBase64(bytes.subarray(start, end), options);",
				"return toBase64(new Uint8Array(bytes.buffer, start, end - start), options);",
				["view"],
			],
			[
				"one-byte-url-padding",
				'const options = alphabet === "base64url" ? ({ alphabet, omitPadding: true } as const) : ({ alphabet } as const);',
				'const options = alphabet === "base64url" ? ({ alphabet, omitPadding: end - start !== 1 } as const) : ({ alphabet } as const);',
				["alphabet"],
			],
		],
	),
	task(
		"base64-concatenated-views",
		"arraybuffer-base64",
		"Encode concatenated byte views",
		"encodeParts(parts). parts must be a dense Array whose every element is a Uint8Array, including Buffer values and subclasses; throw TypeError otherwise. The empty Array is valid. Copy exactly each selected view's bytes into one sequence in input order without changing any input, then return that sequence encoded through toBase64 from the package's Node runtime as unpadded base64url. The result for no bytes is the empty string.",
		["@serve-tools/ponyfill-arraybuffer-base64"],
		[["@serve-tools/ponyfill-arraybuffer-base64/runtime/node"]],
		[
			["views", "validate a dense Array and concatenate exactly every selected view"],
			["canonical", "return canonical unpadded base64url without mutating inputs"],
		],
		[
			["empty-part-offset", "offset += part.byteLength;", "offset += part.byteLength || 1;", ["views"]],
			[
				"one-byte-padding",
				'return toBase64(bytes, { alphabet: "base64url", omitPadding: true });',
				'return toBase64(bytes, { alphabet: "base64url", omitPadding: bytes.byteLength !== 1 });',
				["canonical"],
			],
		],
	),
	task(
		"observable-cold-receipts",
		"ponyfill-observable",
		"Collect two cold receipts",
		"collectReceipts(start, onCleanup). Both arguments must be functions. start takes no arguments and returns the number identifying one run; onCleanup receives that run number. Build one reusable package Observable recipe. Each consumption must call start independently, register onCleanup(run) with subscriber.addTeardown before emitting, emit run and run + 1, complete, and map each emitted value to value * 2. Consume the same recipe twice in sequence with toArray. Resolve Promise<[number[], number[]]> containing [2 * firstRun, 2 * firstRun + 2] and [2 * secondRun, 2 * secondRun + 2]. Teardown runs exactly once after each completed consumption and before collectReceipts resolves; a function returned from the producer is not cleanup.",
		["@serve-tools/ponyfill-observable"],
		[["@serve-tools/ponyfill-observable"]],
		[
			["cold", "start two independent executions and return both mapped arrays"],
			["teardown", "register and run one addTeardown cleanup per completed execution"],
		],
		[
			[
				"shared-result",
				"return [await source.toArray(), await source.toArray()];",
				"const first = await source.toArray();\n\n\treturn [first, [...first]];",
				["cold"],
			],
			[
				"missing-teardown",
				"subscriber.addTeardown(() => onCleanup(run));",
				"void (() => onCleanup(run));",
				["teardown"],
			],
		],
	),
	task(
		"observable-event-cancellation",
		"ponyfill-observable",
		"Cancel a typed event observation",
		'watchUntilAborted(target, signal). target must be an EventTarget and signal an AbortSignal. Use the package when(target, "note") recipe and subscribe with cancellation jointly owned by signal and a private AbortController. Return exactly { seen, stop }, where seen is the same mutable string[] updated synchronously in event order with String((event as CustomEvent).detail), and stop is an idempotent zero-argument function that aborts the private controller. Aborting either signal or calling stop removes only this consumption\'s listener, records no later events, and invokes neither complete nor error notification. A pre-aborted signal yields an empty inactive observation.',
		["@serve-tools/ponyfill-observable"],
		[["@serve-tools/ponyfill-observable"]],
		[
			["event", "receive note details as strings in order and expose stop"],
			["cancel", "either abort owner removes only this listener without terminal notification"],
		],
		[
			[
				"missing-external-signal",
				"signal: AbortSignal.any([signal, controller.signal]),",
				"signal: controller.signal,",
				["cancel"],
			],
			[
				"direct-listener-leak",
				'when(target, "note").subscribe((event) => seen.push(String((event as CustomEvent).detail)), {\n\t\tsignal: AbortSignal.any([signal, controller.signal]),\n\t});',
				'void when(target, "note");\n\ttarget.addEventListener("note", (event) => seen.push(String((event as CustomEvent).detail)));',
				["cancel"],
			],
		],
	),
	task(
		"protocol-framed-audit",
		"realtime-protocol",
		"Decode framed audit values",
		"decodeAuditChunks(chunks). chunks must be a dense Array of Uint8Array chunks. Use one package FrameDecoder for the entire input. Push every chunk in order so fragmented frames are reassembled and multiple coalesced frames are emitted, deserialize each complete payload through the package root serializer in wire order, call decoder.finish() at EOF, and return unknown[] of decoded values. Empty input returns an empty Array. Propagate chunk validation, frame length, deserialization, and finish errors; in particular an incomplete final prefix or payload rejects synchronously with RangeError.",
		["@serve-tools/realtime-protocol"],
		[["@serve-tools/realtime-protocol"], ["@serve-tools/realtime-protocol/stream"]],
		[
			["framing", "decode fragmented and coalesced serialized frames with one decoder"],
			["eof", "finish at EOF and propagate malformed payload errors"],
		],
		[
			[
				"decoder-per-chunk",
				"for (const payload of decoder.push(chunk)) {\n\t\t\tvalues.push(deserialize(payload));\n\t\t}",
				"const chunkDecoder = new FrameDecoder();\n\n\t\tfor (const payload of chunkDecoder.push(chunk)) {\n\t\t\tvalues.push(deserialize(payload));\n\t\t}\n\n\t\tchunkDecoder.finish();",
				["framing"],
			],
			["missing-finish", "decoder.finish();", "void decoder;", ["eof"]],
		],
	),
	task(
		"protocol-datagram-limit",
		"realtime-protocol",
		"Bound structured telemetry datagrams",
		"readMeter(bytes, maximumArrayBufferLength). Decode bytes through the package decodeDatagram(bytes, { maximumArrayBufferLength }) using exactly the caller's limit. Accept only a datagram whose numeric kind is exactly 7 and whose decoded value is a non-null object with exactly one own enumerable key, payload, whose value is an ArrayBuffer. Return payload.byteLength. Throw TypeError for any decoded kind or value shape mismatch, including extra keys, typed-array payloads, and null; propagate package decoding and allocation-limit errors unchanged.",
		["@serve-tools/realtime-protocol"],
		[["@serve-tools/realtime-protocol/datagram"]],
		[
			["limit", "forward the exact maximumArrayBufferLength to structured deserialization"],
			["shape", "require kind 7 and the closed payload ArrayBuffer record"],
		],
		[
			[
				"omitted-limit",
				"const value = decodeDatagram(bytes, { maximumArrayBufferLength });",
				"const value = decodeDatagram(bytes);",
				["limit"],
			],
			["accept-other-kind", "value.kind !== 7 ||", "value.kind < 0 ||", ["shape"]],
		],
	),
	task(
		"http-stream-request-bridge",
		"http-stream",
		"Bridge one authorized HTTP request",
		"createIdentityClient(). Build a real typed finite request named whoami with the client and server HTTP-stream packages and an in-memory Fetch bridge; do not hand-code protocol responses. Return exactly { lookup, close }. lookup(token) returns Promise<string>, sends Authorization with the exact value `Bearer ${token}`, and resolves the server authorization context's token. Server authorization accepts a non-empty token only when the header exactly matches that Bearer form; otherwise it returns a 401 Response, so lookup(\"\") rejects with the client's HTTPError whose status is 401. Support independent calls and preserve each token. close() is idempotent, closes every client owned by the facade and the server handler, and makes later lookup calls reject.",
		["@serve-tools/client-http-stream", "@serve-tools/server-http-stream"],
		[["@serve-tools/client-http-stream"], ["@serve-tools/server-http-stream"]],
		[
			["bridge", "use a real finite protocol exchange and return each string identity"],
			["authorization", "derive server context from an exact non-empty Bearer header and own lifetime"],
		],
		[
			["bypass-request", 'return await client.request("whoami");', "return token;", ["bridge"]],
			[
				"fixed-authorized-identity",
				"return { token: match[1] };",
				'return { token: match[1] === "a" ? match[1] : "identity" };',
				["authorization"],
			],
		],
	),
	task(
		"http-stream-subscription-cleanup",
		"http-stream",
		"Close a streaming subscription",
		"openCounter(input = 1). input must be a finite number; throw TypeError otherwise. Build a real typed subscription named counter with the client and server HTTP-stream packages and an in-memory Fetch bridge. The server emits input once through the framed subscription and returns one cleanup function. Return exactly an object with values, stop, closed, and a readonly cleanupCount getter: values is the same mutable number[] and asynchronously becomes [input]; stop() is an idempotent zero-argument function that unsubscribes and closes owned client resources; closed is a Promise<void> that settles only after stop has caused the returned server cleanup to finish; cleanupCount starts at 0 and is exactly 1 when closed resolves. No reconnect or bidirectional send is required.",
		["@serve-tools/client-http-stream", "@serve-tools/server-http-stream"],
		[["@serve-tools/client-http-stream"], ["@serve-tools/server-http-stream"]],
		[
			["stream", "receive the input once through a framed subscription"],
			["ownership", "idempotent stop awaits exactly one observable server cleanup"],
		],
		[
			["fixed-event-value", "emit(value);", "emit(value === 2 ? value : 2);", ["stream"]],
			[
				"unobserved-cleanup",
				"return () => {\n\t\t\t\t\t++cleanupCount;\n\t\t\t\t\tcleanupFinished.resolve();\n\t\t\t\t};",
				"return () => {\n\t\t\t\t\tcleanupFinished.resolve();\n\t\t\t\t};",
				["ownership"],
			],
		],
	),
	task(
		"sse-server-replay",
		"sse",
		"Replay and broadcast SSE",
		'createReplayFeed(). Build a package server-event-source handler and application-owned in-memory tick history. Return exactly { fetch, send, close }. send(value) requires a finite number, stores { value } with id String(value), and broadcasts one named JSON tick event with that same id; invalid values throw TypeError without storing or broadcasting. fetch(lastEventId?) calls the handler with a GET Request whose Last-Event-ID header is present exactly when the optional string is supplied. On connection, if that id matches a stored tick, replay to that connection every later stored tick in original send order; an absent or unknown id replays nothing. fetch resolves the handler Response. close() is idempotent and owns the handler. Both replayed and live events have wire fields `event: tick`, `id: <value>`, and `data: {"value":<value>}`. The package\'s event-stream Content-Type, Cache-Control, and X-Accel-Buffering response headers remain authoritative.',
		["@serve-tools/server-event-source"],
		[["@serve-tools/server-event-source"]],
		[
			["replay", "use Last-Event-ID and application history for ordered per-connection replay"],
			["wire", "broadcast named JSON tick events with stable ids and authoritative headers"],
		],
		[
			[
				"wrong-replay-header",
				'headers.set("Last-Event-ID", lastEventId);',
				'headers.set("X-Ignored-Last-Event-ID", lastEventId);',
				["replay"],
			],
			[
				"unnamed-live-event",
				'handler.send("tick", tick, { id: String(value) });',
				'handler.send("message", tick, { id: String(value) });',
				["wire"],
			],
		],
	),
	task(
		"sse-client-json-subscription",
		"sse",
		"Subscribe to typed SSE JSON",
		"connectStatus(url, signal?). The checks install an EventSource-compatible environment before loading solution.ts and restore it afterward. url is a string or URL and signal, when supplied, is an AbortSignal. Use package connect with the lifetime signal and subscribe to the named status event typed as { state: string }. Return exactly { states, close, closed }: states is the same mutable string[] and each valid named JSON event appends `${lastEventId}:${data.state}` in order; close is the client's idempotent zero-argument close function; closed is its Promise<void>. Malformed JSON is reported by the package through reportError and records no state. Calling close or aborting the lifetime signal closes the EventSource, removes the subscription so later dispatched events record nothing, and resolves closed. Do not install, replace, or otherwise mutate globals.",
		["@serve-tools/client-event-source"],
		[["@serve-tools/client-event-source"]],
		[
			["typed", "parse named status JSON and return states, close, and closed"],
			["lifetime", "manual close or lifetime abort closes the source and removes the subscription"],
		],
		[
			[
				"raw-listener",
				'client.subscribe("status", ({ data, lastEventId }) => states.push(`${lastEventId}:${data.state}`));',
				'client.source.addEventListener("status", (event) => {\n\t\tconst message = event as MessageEvent<string>;\n\t\tconst data = JSON.parse(message.data) as { state: string };\n\n\t\tstates.push(`${message.lastEventId}:${data.state}`);\n\t});',
				["typed"],
			],
			[
				"unlinked-lifetime",
				"const client = connect<{ status: { state: string } }>(url, { signal });",
				"const client = connect<{ status: { state: string } }>(url);",
				["lifetime"],
			],
		],
	),
	task(
		"scheduler-priority-promotion",
		"prioritized-task-scheduling",
		"Promote queued task priority",
		'runPromotedOrder(labels = ["controlled", "visible"]). labels must be a dense two-element Array of strings; throw TypeError otherwise. Create a package TaskController at background priority. Queue one package scheduler task associated only with its dynamic signal that pushes labels[0], then queue user-visible work that pushes labels[1]. Before either callback dispatches, call controller.setPriority("user-blocking"). Await both callbacks and resolve string[] containing their observed execution order, which is [labels[0], labels[1]]. Do not set an explicit priority on the controlled task because that would override dynamic promotion.',
		["@serve-tools/ponyfill-prioritized-task-scheduling"],
		[["@serve-tools/ponyfill-prioritized-task-scheduling"]],
		[
			["dynamic", "promote the controller-owned queued task from background to user-blocking"],
			["scheduler", "return the two caller labels in actual scheduler execution order"],
		],
		[
			[
				"pinned-controlled-priority",
				"const controlled = scheduler.postTask(() => order.push(labels[0]), { signal: controller.signal });",
				'const controlled = scheduler.postTask(() => order.push(labels[0]), { priority: "background", signal: controller.signal });',
				["dynamic"],
			],
			[
				"hardcoded-visible-label",
				'const visible = scheduler.postTask(() => order.push(labels[1]), { priority: "user-visible" });',
				'const visible = scheduler.postTask(() => order.push("visible"), { priority: "user-visible" });',
				["scheduler"],
			],
		],
	),
	task(
		"scheduler-cancel-reschedule",
		"prioritized-task-scheduling",
		"Cancel then reschedule work",
		'cancelThenReschedule(reason?). Create ran as a string[]. Under one package TaskController, schedule a callback that would push "cancelled" after a 30 ms delay and pass the controller signal. Immediately abort: when reason is supplied pass that exact value to abort, and when omitted call abort() so the platform creates its default AbortError. Await the scheduled promise and retain its exact rejection value as cancellation. Then create a fresh TaskController and use its signal to schedule and await one immediate callback that pushes "replacement". Resolve exactly { ran, cancellation }; ran is ["replacement"], the cancelled callback never runs later, a supplied cancellation preserves identity, and omitted reason produces the controller signal\'s default AbortError.',
		["@serve-tools/ponyfill-prioritized-task-scheduling"],
		[["@serve-tools/ponyfill-prioritized-task-scheduling"]],
		[
			["cancel", "link delayed work and preserve the controller's exact rejection reason"],
			["replacement", "fresh controller ownership runs exactly one replacement"],
		],
		[
			[
				"unlinked-cancellation",
				'const cancelled = scheduler.postTask(() => ran.push("cancelled"), { signal: controller.signal, delay: 30 });',
				'const cancelled = scheduler.postTask(() => ran.push("cancelled"), { delay: 30 });',
				["cancel"],
			],
			["wrapped-rejection", "cancellation = error;", "cancellation = new Error(String(error));", ["cancel"]],
		],
	),
];
