import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { CodexProvider } from "../provider.mjs";

const usage = {
	cacheWriteInputTokens: 0,
	cachedInputTokens: 11,
	inputTokens: 101,
	outputTokens: 23,
	reasoningOutputTokens: 7,
	totalTokens: 124,
};

test("Codex provider isolates an ephemeral thread and serves dynamic tools", { timeout: 2_000 }, async () => {
	let appServer;
	let spawnArguments;
	let threadStart;
	let turnStart;
	let toolResponse;
	const events = [];
	const toolCalls = [];

	const provider = new CodexProvider({
		allowedInstructionSources: [],
		effort: "low",
		model: "test-model",
		spawnImplementation(command, arguments_, options) {
			spawnArguments = { arguments_, command, options };
			appServer = new FakeAppServer((message) => {
				if (message.method === "initialize") {
					appServer.respond(message.id, { userAgent: "test" });
				} else if (message.method === "thread/start") {
					threadStart = message.params;
					appServer.respond(message.id, {
						instructionSources: [],
						model: "test-model",
						thread: { id: "thread-1" },
					});
				} else if (message.method === "turn/start") {
					turnStart = message.params;
					appServer.respond(message.id, { turn: { id: "turn-1", items: [], status: "inProgress" } });
					appServer.send(
						{
							id: 800,
							method: "item/tool/call",
							params: {
								arguments: { path: "virtual.md" },
								callId: "call-1",
								threadId: "thread-1",
								tool: "read_virtual",
								turnId: "turn-1",
							},
						},
						true,
					);
				} else if (message.id === 800) {
					toolResponse = message.result;
					appServer.notify("item/completed", {
						completedAtMs: 1,
						item: { id: "message-1", phase: "final_answer", text: "done", type: "agentMessage" },
						threadId: "thread-1",
						turnId: "turn-1",
					});
					appServer.notify("thread/tokenUsage/updated", {
						threadId: "thread-1",
						tokenUsage: { last: usage, total: usage },
						turnId: "turn-1",
					});
					appServer.notify("turn/completed", {
						threadId: "thread-1",
						turn: { id: "turn-1", items: [], status: "completed" },
					});
				}
			});
			return appServer;
		},
	});

	try {
		const result = await provider.run({
			onEvent: (event) => events.push(event.method),
			onTool: async (name, arguments_, context) => {
				toolCalls.push({ arguments_, context, name });
				return { contents: "virtual contents" };
			},
			prompt: "TASK AND DISCOVERY ONLY",
			timeoutMs: 500,
			tools: [
				{
					description: "Read one virtual document",
					inputSchema: {
						additionalProperties: false,
						properties: { path: { type: "string" } },
						required: ["path"],
						type: "object",
					},
					name: "read_virtual",
				},
			],
		});

		assert.equal(spawnArguments.command, "codex");
		assert.deepEqual(spawnArguments.options.stdio, ["pipe", "pipe", "pipe"]);
		assert.notEqual(spawnArguments.options.cwd, process.cwd());
		assert.equal(spawnArguments.options.env.OPENAI_API_KEY, undefined);
		assert.notEqual(spawnArguments.arguments_.at(-1), "-c");
		for (const feature of ["apps", "memories", "plugins", "shell_tool", "skill_search", "multi_agent"]) {
			assert.ok(hasArgumentPair(spawnArguments.arguments_, "--disable", feature));
		}
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "mcp_servers={}"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "agents.enabled=false"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "include_apps_instructions=false"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "include_collaboration_mode_instructions=false"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "include_environment_context=false"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "project_doc_max_bytes=0"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "shell_environment_policy.inherit=none"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "skills.bundled.enabled=false"));
		assert.ok(hasArgumentPair(spawnArguments.arguments_, "-c", "skills.include_instructions=false"));
		assert.equal(threadStart.allowProviderModelFallback, false);
		assert.equal(threadStart.approvalPolicy, "on-request");
		assert.equal(threadStart.ephemeral, true);
		assert.deepEqual(threadStart.environments, []);
		assert.deepEqual(threadStart.runtimeWorkspaceRoots, []);
		assert.deepEqual(threadStart.selectedCapabilityRoots, []);
		assert.equal(threadStart.sandbox, "read-only");
		assert.deepEqual(threadStart.dynamicTools, [
			{
				description: "Read one virtual document",
				inputSchema: {
					additionalProperties: false,
					properties: { path: { type: "string" } },
					required: ["path"],
					type: "object",
				},
				name: "read_virtual",
				type: "function",
			},
		]);
		assert.match(threadStart.baseInstructions, /platform safety and authorization policies/);
		assert.match(threadStart.developerInstructions, /finite tools explicitly supplied/);
		assert.deepEqual(turnStart.input, [{ text: "TASK AND DISCOVERY ONLY", type: "text" }]);
		assert.equal(turnStart.effort, "low");
		assert.equal(turnStart.model, "test-model");
		assert.deepEqual(turnStart.environments, []);
		assert.deepEqual(turnStart.runtimeWorkspaceRoots, []);
		assert.deepEqual(turnStart.sandboxPolicy, { networkAccess: false, type: "readOnly" });

		assert.deepEqual(toolCalls, [
			{
				arguments_: { path: "virtual.md" },
				context: { callId: "call-1", threadId: "thread-1", turnId: "turn-1" },
				name: "read_virtual",
			},
		]);
		assert.deepEqual(toolResponse, {
			contentItems: [{ text: JSON.stringify({ contents: "virtual contents" }), type: "inputText" }],
			success: true,
		});
		assert.deepEqual(events, ["item/completed", "thread/tokenUsage/updated", "turn/completed"]);
		assert.deepEqual(result, {
			attempts: { failed: 0, model: 1 },
			backendStatus: "completed",
			commonContext: { instructionSources: [] },
			error: undefined,
			finalText: "done",
			measurementError: undefined,
			model: "test-model",
			status: "completed",
			threadId: "thread-1",
			usage,
			usageComplete: true,
		});
	} finally {
		await provider.close();
	}
});

test("Codex provider returns timeout state and interrupts the active turn", { timeout: 2_000 }, async () => {
	let appServer;
	const messages = [];
	const provider = new CodexProvider({
		allowedInstructionSources: [],
		model: "test-model",
		spawnImplementation() {
			appServer = standardAppServer((message) => messages.push(message));
			return appServer;
		},
	});

	try {
		const result = await provider.run({ prompt: "timeout", timeoutMs: 20 });

		assert.equal(result.status, "timedOut");
		assert.equal(result.backendStatus, null);
		assert.equal(result.usage, null);
		assert.equal(result.usageComplete, false);
		assert.match(result.measurementError, /before reporting token usage/);
		assert.deepEqual(result.attempts, { failed: 1, model: 1 });
		assert.ok(messages.some((message) => message.method === "turn/interrupt"));
	} finally {
		await provider.close();
	}
});

test("Codex provider refuses model fallback and annotates an unavailable-model failure", {
	timeout: 2_000,
}, async () => {
	let threadStart;
	const provider = new CodexProvider({
		allowedInstructionSources: [],
		model: "unavailable-model",
		spawnImplementation() {
			return new FakeAppServer((message, appServer) => {
				if (message.method === "initialize") {
					appServer.respond(message.id, { userAgent: "test" });
				} else if (message.method === "thread/start") {
					threadStart = message.params;
					appServer.respondError(message.id, -32_000, "model is unavailable");
				}
			});
		},
	});

	try {
		await assert.rejects(provider.run({ prompt: "fail" }), (error) => {
			assert.match(error.message, /model is unavailable/);
			assert.equal(error.status, "failed");
			assert.deepEqual(error.attempts, { failed: 1, model: 1 });
			assert.equal(error.usage, null);
			return true;
		});
		assert.equal(threadStart.allowProviderModelFallback, false);
	} finally {
		await provider.close();
	}
});

test("Codex provider refuses extra tool calls, then retains final usage from a completed budget-exhausted turn", {
	timeout: 2_000,
}, async () => {
	let appServer;
	const messages = [];
	const toolCalls = [];
	const provider = new CodexProvider({
		accountingDrainMs: 10,
		allowedInstructionSources: [],
		maxToolCalls: 1,
		model: "test-model",
		toolGraceMs: 10,
		spawnImplementation() {
			appServer = standardAppServer((message) => {
				messages.push(message);
				if (message.method === "turn/start") {
					for (const id of [900, 901, 902]) {
						appServer.send({
							id,
							method: "item/tool/call",
							params: {
								arguments: {},
								callId: `call-${id}`,
								threadId: "thread-standard",
								tool: "finish",
								turnId: "turn-standard",
							},
						});
					}
				} else if (message.id === 901) {
					appServer.notify("thread/tokenUsage/updated", {
						threadId: "thread-standard",
						tokenUsage: { last: usage, total: usage },
						turnId: "turn-standard",
					});
					appServer.notify("item/completed", {
						item: {
							id: "message-final",
							phase: "final_answer",
							text: "budget reached",
							type: "agentMessage",
						},
						threadId: "thread-standard",
						turnId: "turn-standard",
					});
					appServer.notify("turn/completed", {
						threadId: "thread-standard",
						turn: { id: "turn-standard", items: [], status: "completed" },
					});
				}
			});
			return appServer;
		},
	});

	try {
		const result = await provider.run({
			onTool: async () => {
				toolCalls.push("finish");
				return { ok: true };
			},
			prompt: "budget",
			timeoutMs: 500,
			tools: [{ description: "Finish", inputSchema: { type: "object" }, name: "finish" }],
		});

		assert.equal(result.status, "toolLimitExceeded");
		assert.equal(result.backendStatus, "completed");
		assert.deepEqual(result.usage, usage);
		assert.equal(result.usageComplete, true);
		assert.equal(result.measurementError, undefined);
		assert.deepEqual(toolCalls, ["finish"]);
		assert.match(messages.find((message) => message.id === 902).result.contentItems[0].text, /no longer accepts/);
		assert.equal(messages.filter((message) => message.method === "turn/interrupt").length, 0);
	} finally {
		await provider.close();
	}
});

test("Codex provider hard-interrupts a budget-exhausted turn that does not finish its accounting drain", {
	timeout: 2_000,
}, async () => {
	const messages = [];
	const provider = new CodexProvider({
		accountingDrainMs: 10,
		allowedInstructionSources: [],
		maxToolCalls: 0,
		model: "test-model",
		toolGraceMs: 10,
		spawnImplementation() {
			return standardAppServer((message, appServer) => {
				messages.push(message);
				if (message.method === "turn/start") {
					appServer.send({
						id: 902,
						method: "item/tool/call",
						params: {
							arguments: { contents: "must not be written" },
							callId: "call-902",
							threadId: "thread-standard",
							tool: "write_virtual",
							turnId: "turn-standard",
						},
					});
				}
			});
		},
	});

	try {
		let writes = 0;
		const result = await provider.run({
			onTool: async () => {
				++writes;
				return { ok: true };
			},
			prompt: "budget fallback",
			timeoutMs: 500,
			tools: [
				{ description: "Write a virtual document", inputSchema: { type: "object" }, name: "write_virtual" },
			],
		});

		assert.equal(result.status, "toolLimitExceeded");
		assert.equal(result.backendStatus, null);
		assert.equal(writes, 0);
		assert.match(messages.find((message) => message.id === 902).result.contentItems[0].text, /limit/);
		assert.ok(messages.some((message) => message.method === "turn/interrupt"));
	} finally {
		await provider.close();
	}
});

test("Codex provider rejects built-in execution and preserves observed usage as incomplete", {
	timeout: 2_000,
}, async () => {
	let appServer;
	const messages = [];
	const provider = new CodexProvider({
		allowedInstructionSources: [],
		model: "test-model",
		spawnImplementation() {
			appServer = standardAppServer((message) => {
				messages.push(message);
				if (message.method === "turn/start") {
					appServer.notify("thread/tokenUsage/updated", {
						threadId: "thread-standard",
						tokenUsage: { last: usage, total: usage },
						turnId: "turn-standard",
					});
					appServer.notify("item/started", {
						item: { id: "command-1", type: "commandExecution" },
						threadId: "thread-standard",
						turnId: "turn-standard",
					});
				}
			});
			return appServer;
		},
	});

	try {
		const result = await provider.run({ prompt: "isolation", timeoutMs: 500 });

		assert.equal(result.status, "isolationViolation");
		assert.equal(result.backendStatus, null);
		assert.equal(result.error, "Unexpected built-in tool item commandExecution");
		assert.deepEqual(result.usage, usage);
		assert.equal(result.usageComplete, false);
		assert.match(result.measurementError, /lower bound/);
		assert.ok(messages.some((message) => message.method === "turn/interrupt"));
	} finally {
		await provider.close();
	}
});

test("Codex provider drains late cumulative usage after backend completion without double counting", {
	timeout: 2_000,
}, async () => {
	const earlierUsage = { ...usage, inputTokens: 80, totalTokens: 100 };
	const provider = new CodexProvider({
		accountingDrainMs: 10,
		allowedInstructionSources: [],
		model: "test-model",
		spawnImplementation() {
			return standardAppServer((message, appServer) => {
				if (message.method !== "turn/start") {
					return;
				}
				appServer.notify("thread/tokenUsage/updated", {
					threadId: "thread-standard",
					tokenUsage: { last: earlierUsage, total: earlierUsage },
					turnId: "turn-standard",
				});
				appServer.notify("turn/completed", {
					threadId: "thread-standard",
					turn: { id: "turn-standard", items: [], status: "completed" },
				});
				setTimeout(() => {
					appServer.notify("thread/tokenUsage/updated", {
						threadId: "thread-standard",
						tokenUsage: { last: usage, total: usage },
						turnId: "turn-standard",
					});
				}, 2);
			});
		},
	});

	try {
		const result = await provider.run({ prompt: "late usage", timeoutMs: 500 });

		assert.equal(result.status, "completed");
		assert.equal(result.backendStatus, "completed");
		assert.deepEqual(result.usage, usage);
		assert.equal(result.usage.totalTokens, usage.totalTokens);
		assert.equal(result.usageComplete, true);
	} finally {
		await provider.close();
	}
});

test("Codex provider preserves timed-out usage as incomplete even if a racing backend completion reports counters", {
	timeout: 2_000,
}, async () => {
	const messages = [];
	const provider = new CodexProvider({
		accountingDrainMs: 10,
		allowedInstructionSources: [],
		model: "test-model",
		spawnImplementation() {
			return standardAppServer((message, appServer) => {
				messages.push(message);
				if (message.method !== "turn/interrupt") {
					return;
				}
				appServer.respond(message.id, {});
				setTimeout(() => {
					appServer.notify("thread/tokenUsage/updated", {
						threadId: "thread-standard",
						tokenUsage: { last: usage, total: usage },
						turnId: "turn-standard",
					});
					appServer.notify("turn/completed", {
						threadId: "thread-standard",
						turn: { id: "turn-standard", items: [], status: "completed" },
					});
				}, 2);
			});
		},
	});

	try {
		const result = await provider.run({ prompt: "timeout", timeoutMs: 5 });

		assert.equal(result.status, "timedOut");
		assert.equal(result.backendStatus, "completed");
		assert.deepEqual(result.usage, usage);
		assert.equal(result.usageComplete, false);
		assert.match(result.measurementError, /lower bound/);
		assert.ok(messages.some((message) => message.method === "turn/interrupt"));
	} finally {
		await provider.close();
	}
});

test("Codex provider marks a completed turn without terminal usage as incomplete", { timeout: 2_000 }, async () => {
	const provider = new CodexProvider({
		accountingDrainMs: 10,
		allowedInstructionSources: [],
		model: "test-model",
		spawnImplementation() {
			return standardAppServer((message, appServer) => {
				if (message.method === "turn/start") {
					appServer.notify("turn/completed", {
						threadId: "thread-standard",
						turn: { id: "turn-standard", items: [], status: "completed" },
					});
				}
			});
		},
	});

	try {
		const result = await provider.run({ prompt: "missing usage", timeoutMs: 500 });

		assert.equal(result.status, "completed");
		assert.equal(result.backendStatus, "completed");
		assert.equal(result.usage, null);
		assert.equal(result.usageComplete, false);
		assert.match(result.measurementError, /did not emit thread token usage/);
	} finally {
		await provider.close();
	}
});

class FakeAppServer extends EventEmitter {
	constructor(handleMessage) {
		super();
		this.exitCode = null;
		this.signalCode = null;
		this.stdout = new PassThrough();
		this.stderr = new PassThrough();
		let buffer = "";
		this.stdin = new Writable({
			write: (chunk, _encoding, callback) => {
				buffer += chunk.toString();
				for (let newline = buffer.indexOf("\n"); newline !== -1; newline = buffer.indexOf("\n")) {
					const message = JSON.parse(buffer.slice(0, newline));
					buffer = buffer.slice(newline + 1);
					handleMessage(message, this);
				}
				callback();
			},
		});
	}

	kill(signal = "SIGTERM") {
		this.signalCode = signal;
		queueMicrotask(() => this.emit("exit", null, signal));
		return true;
	}

	notify(method, params) {
		this.send({ method, params });
	}

	respond(id, result) {
		this.send({ id, result });
	}

	respondError(id, code, message) {
		this.send({ error: { code, message }, id });
	}

	send(message, split = false) {
		const line = `${JSON.stringify(message)}\n`;
		if (split) {
			const middle = Math.floor(line.length / 2);
			this.stdout.write(line.slice(0, middle));
			this.stdout.write(line.slice(middle));
		} else {
			this.stdout.write(line);
		}
	}
}

function hasArgumentPair(arguments_, first, second) {
	return arguments_.some((argument, index) => argument === first && arguments_[index + 1] === second);
}

function standardAppServer(onMessage) {
	return new FakeAppServer((message, appServer) => {
		onMessage(message, appServer);
		if (message.method === "initialize") {
			appServer.respond(message.id, { userAgent: "test" });
		} else if (message.method === "thread/start") {
			appServer.respond(message.id, {
				instructionSources: [],
				model: "test-model",
				thread: { id: "thread-standard" },
			});
		} else if (message.method === "turn/start") {
			appServer.respond(message.id, { turn: { id: "turn-standard", items: [], status: "inProgress" } });
		}
	});
}
