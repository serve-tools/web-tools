import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../../../", import.meta.url));

if (typeof globalThis.URLPattern !== "function") {
	await import("@serve-tools/polyfill-urlpattern");
}

async function example(location, index = 0) {
	const markdown = await readFile(path.join(repository, location, "README.md"), "utf8");
	const blocks = [...markdown.matchAll(/^```ts\n([\s\S]*?)^```/gm)];
	assert.ok(blocks[index], `${location} must retain example ${index + 1}`);
	return blocks[index][1];
}

async function withExamples(files, run) {
	await mkdir(path.join(repository, "dist"), { recursive: true });
	const directory = await mkdtemp(path.join(repository, "dist/docs-readme-"));
	try {
		for (const [name, source] of Object.entries(files)) {
			await writeFile(path.join(directory, `${name}.ts`), source);
		}
		await execute(path.join(repository, "node_modules/.bin/tsc"), [
			"--ignoreConfig",
			"--strict",
			"--target",
			"es2022",
			"--lib",
			"esnext,dom,dom.iterable",
			"--outDir",
			path.join(directory, "output"),
			"--rootDir",
			directory,
			"--module",
			"nodenext",
			"--skipLibCheck",
			"--types",
			"node",
			...Object.keys(files).map((name) => path.join(directory, `${name}.ts`)),
		]);
		await run((name) => import(pathToFileURL(path.join(directory, "output", `${name}.js`)).href));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("the documented HTTP handler stays live after its module evaluates and serves the paired client", async () => {
	const server = await example("server/http-stream");
	const browser = await example("server/http-stream", 1);
	await withExamples({ realtime: server, browser }, async (load) => {
		const { default: application, realtime } = await load("realtime");
		const { connect } = await import("../../../client/http-stream/dist/client-http-stream.js");
		assert.equal(application.fetch, realtime);
		const client = connect("http://localhost:3000", {
			fetch: (input, init) => application.fetch(new Request(input, init)),
		});
		try {
			assert.deepEqual(await client.request("getRoom", { room: "lobby" }), { title: "Room: lobby" });
			let subscription;
			try {
				const event = await new Promise((resolve, reject) => {
					const signal = AbortSignal.timeout(5_000);
					signal.addEventListener("abort", () => reject(signal.reason), { once: true });
					subscription = client.subscribe("clock", resolve, {
						signal,
						onError: reject,
					});
				});
				assert.ok(Number.isFinite(Date.parse(event.time)));
			} finally {
				subscription?.[Symbol.dispose]();
			}
		} finally {
			client.close();
			realtime.close();
		}
		assert.equal((await application.fetch(new Request("http://localhost:3000"))).status, 503);
	});
});

test("the documented router examples round trip simple and typed URL values", async () => {
	await withExamples(
		{
			simple: `${await example("core/router")}\nexport { href, match };`,
			typed: `${await example("core/router", 1)}\nexport { href, match, projectRoute };`,
		},
		async (load) => {
			const simple = await load("simple");
			assert.equal(simple.href, "/projects/team%20notes");
			assert.equal(simple.match.params.id, "team notes");
			const typed = await load("typed");
			assert.equal(typed.href, "/projects/42?tag=active&tag=mine");
			assert.deepEqual(typed.match.search, { tab: "overview", tag: ["active", "mine"] });
			assert.equal(typed.match.params.id, 42);
			assert.equal(typed.projectRoute.match("/projects/not-a-number"), null);
		},
	);
});

test("the documented import operation reports progress and preserves its completed result after disposal", async () => {
	await withExamples(
		{ operation: `${await example("core/async-operation")}\nexport { operation, imported };` },
		async (load) => {
			const { operation, imported } = await load("operation");
			assert.deepEqual(imported, ["Ada", "Grace", "Linus"]);
			assert.equal(await operation.result, 3);
			await operation.finished;
		},
	);
});

test("the documented WebSocket server and browser agree on their protocol", async () => {
	await withExamples(
		{
			room: await example("server/websocket"),
			server: await example("server/websocket", 1),
			browser: await example("server/websocket", 2),
		},
		async (load) => {
			const { handlers } = await load("room");
			assert.deepEqual(handlers.requests.getRoom({ id: "lobby" }, { connection: { userID: "local-demo" } }), {
				title: "local-demo:lobby",
			});
		},
	);
});

test("the documented EventSource handler delivers the initial event to a connected browser", async () => {
	await withExamples({ events: await example("server/event-source") }, async (load) => {
		const { default: application, events } = await load("events");
		const response = await application.fetch(new Request("http://localhost/events"));
		const reader = response.body.getReader();
		try {
			const { value } = await reader.read();
			const text = new TextDecoder().decode(value);
			assert.match(text, /event: presence/);
			assert.match(text, /data: \{"online":3\}/);
		} finally {
			await reader.cancel();
			events.close();
		}
	});
});

test("the documented structured-value example retains its Map and typed array", async () => {
	await withExamples({ protocol: `${await example("realtime/protocol")}\nexport { restored };` }, async (load) => {
		const { restored } = await load("protocol");
		assert.ok(restored instanceof Map);
		assert.deepEqual(restored.get("samples"), new Float32Array([0.25, 0.5, 1]));
	});
});

test("the documented connection core runs a complete in-memory protocol exchange", async () => {
	await withExamples(
		{ connection: `${await example("server/realtime")}\nexport { reply, connection };` },
		async (load) => {
			const { reply, connection } = await load("connection");
			const { protocol } = await import("@serve-tools/realtime-protocol");
			assert.deepEqual(await reply.promise, [protocol, "resolve", 1, "local-demo"]);
			await connection.closed;
		},
	);
});

test("the documented WebTransport handlers compile with their adapter and use verified session identity", async () => {
	await withExamples(
		{ board: await example("server/webtransport"), adapter: await example("server/webtransport", 1) },
		async (load) => {
			const { handlers } = await load("board");
			assert.deepEqual(handlers.requests.loadBoard("demo"), { title: "Board: demo" });
			const writes = [];
			await handlers.datagrams.cursor(
				{ x: 3, y: 7, userID: "untrusted-input" },
				{
					connection: { userID: "verified-user" },
					datagrams: { write: async (kind, value) => void writes.push({ kind, value }) },
				},
			);
			assert.deepEqual(writes, [{ kind: "cursor", value: { x: 3, y: 7, userID: "verified-user" } }]);
			const { realtime } = await load("adapter");
			realtime.close();
		},
	);
});
