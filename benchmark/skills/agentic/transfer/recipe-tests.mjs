import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const transferDirectory = path.dirname(fileURLToPath(import.meta.url));
const recipesDirectory = path.join(transferDirectory, "recipes");
const repositoryDirectory = path.resolve(transferDirectory, "../../../..");
const typescript = path.join(repositoryDirectory, "node_modules", ".bin", "tsc");
const manifest = JSON.parse(await readFile(path.join(recipesDirectory, "manifest.json"), "utf8"));

const loadRecipe = async (file) => {
	const source = path.join(recipesDirectory, file);
	const output = await mkdtemp(path.join(recipesDirectory, ".compiled-"));
	const result = spawnSync(
		typescript,
		[
			"--ignoreConfig",
			source,
			"--target",
			"ES2024",
			"--module",
			"NodeNext",
			"--moduleResolution",
			"NodeNext",
			"--lib",
			"ES2024,DOM,DOM.Iterable,ESNext.Disposable",
			"--strict",
			"--exactOptionalPropertyTypes",
			"--skipLibCheck",
			"--verbatimModuleSyntax",
			"--outDir",
			output,
		],
		{
			cwd: repositoryDirectory,
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		},
	);

	try {
		assert.equal(result.status, 0, `TypeScript failed for ${file}:\n${result.stdout}${result.stderr}`);

		const javascript = path.join(output, file.replace(/\.ts$/, ".js"));
		const module = await import(`${pathToFileURL(javascript).href}?test=${Date.now()}`);

		return { module, output };
	} catch (error) {
		await rm(output, { recursive: true, force: true });
		throw error;
	}
};

const withRecipe = async (file, callback) => {
	const { module, output } = await loadRecipe(file);

	try {
		await callback(module);
	} finally {
		await rm(output, { recursive: true, force: true });
	}
};

test("manifest routes eight standalone recipes with stable adapter markers", async () => {
	assert.equal(manifest.length, 8);
	assert.equal(new Set(manifest.map(({ id }) => id)).size, 8);

	for (const entry of manifest) {
		assert.equal(typeof entry.id, "string");
		assert.equal(typeof entry.title, "string");
		assert.ok(Array.isArray(entry.packages) && entry.packages.length > 0);
		assert.match(entry.file, /^[a-z0-9-]+\.ts$/);
		assert.equal(typeof entry.description, "string");
		assert.equal(typeof entry.whenToUse, "string");
		assert.ok(Array.isArray(entry.preservedSymbols) && entry.preservedSymbols.length > 0);

		const source = await readFile(path.join(recipesDirectory, entry.file), "utf8");

		assert.ok(source.endsWith("// Add your task adapter below.\n"), entry.file);
		for (const symbol of entry.preservedSymbols) {
			assert.match(source, new RegExp(`\\b${symbol}\\b`), `${entry.file} does not contain ${symbol}`);
		}
	}
});

test("router recipe reverses defaults and rejects non-canonical integer inputs", async () => {
	await withRecipe("router.ts", async ({ createResourceRoute, matchFirstRoute }) => {
		const entries = createResourceRoute();
		const href = entries.href({ params: { id: 42 }, search: { tag: ["one", "two"] } });

		assert.equal(href, "/resources/42?tag=one&tag=two");

		const match = matchFirstRoute([entries], `https://example.test${href}`);

		assert.equal(match?.path, "/resources/:id");
		assert.deepEqual(match?.params, { id: 42 });
		assert.deepEqual(match?.search, {
			view: "summary",
			tag: ["one", "two"],
			cursor: undefined,
		});
		assert.throws(() => entries.href({ params: { id: -0 } }), TypeError);
		assert.equal(entries.match("https://example.test/resources/-0"), null);
		assert.equal(entries.match("https://example.test/resources/9007199254740992"), null);
	});
});

test("async-operation recipe validates capacity, preserves backpressure, and propagates cancellation", async () => {
	await withRecipe(
		"async-operation.ts",
		async ({ collectOperation, createPacedOperation, normalizeBoundedCapacity }) => {
			assert.equal(normalizeBoundedCapacity(undefined), 0);
			assert.equal(normalizeBoundedCapacity(3), 3);
			assert.throws(() => normalizeBoundedCapacity(null), TypeError);
			assert.throws(() => normalizeBoundedCapacity(1.5), TypeError);
			assert.throws(() => normalizeBoundedCapacity(-0), TypeError);

			let pulls = 0;
			const source = {
				[Symbol.asyncIterator]() {
					let value = 0;

					return {
						async next() {
							++pulls;

							return value < 3 ? { value: ++value, done: false } : { value: undefined, done: true };
						},
					};
				},
			};
			const operation = createPacedOperation(source, "complete");

			await Promise.resolve();
			assert.equal(pulls, 1, "the zero-buffer producer advanced before its first value was consumed");
			assert.deepEqual(await collectOperation(operation), {
				values: [1, 2, 3],
				result: "complete",
			});

			const controller = new AbortController();
			let sourceSignal;
			const cancelled = createPacedOperation(
				(signal) => {
					sourceSignal = signal;

					return {
						async *[Symbol.asyncIterator]() {
							while (true) {
								signal.throwIfAborted();
								yield 1;
							}
						},
					};
				},
				"unreachable",
				{ signal: controller.signal },
			);
			const reason = new Error("cancelled by owner");

			await Promise.resolve();
			assert.equal(sourceSignal, cancelled.signal);
			controller.abort(reason);
			await assert.rejects(cancelled.result, (error) => error === reason);
			await cancelled.finished;
		},
	);
});

test("http-contract recipe validates safe integers and serves typed JSON and bodyless branches", async () => {
	await withRecipe(
		"http-contract-router.ts",
		async ({ createRecordsHandler, recordsAPI, safeInteger, standardSchema }) => {
			assert.equal(safeInteger(12), 12);
			assert.throws(() => safeInteger(-0), TypeError);
			assert.throws(() => safeInteger(Number.MAX_SAFE_INTEGER + 1), TypeError);

			const schema = standardSchema((value) => {
				if (typeof value !== "string") {
					throw new TypeError("Expected text");
				}

				return value.length;
			});

			assert.deepEqual(schema["~standard"].validate("abcd"), { value: 4 });
			assert.ok("issues" in schema["~standard"].validate(null));
			assert.equal(recordsAPI.routes["/records/:id"].DELETE.responses[204], null);

			const records = new Map([[7, "seven"]]);
			const handle = createRecordsHandler(records);
			const found = await handle(new Request("https://example.test/records/7?view=expanded"));

			assert.equal(found.status, 200);
			assert.deepEqual(await found.json(), { id: 7, label: "seven" });

			const removed = await handle(new Request("https://example.test/records/7", { method: "DELETE" }));

			assert.equal(removed.status, 204);
			assert.equal(await removed.text(), "");

			const missing = await handle(new Request("https://example.test/records/7"));

			assert.equal(missing.status, 404);
			assert.deepEqual(await missing.json(), { error: "not_found" });
		},
	);
});

test("signal collection recipe rejects sparse/non-finite input before publishing reactive totals", async () => {
	await withRecipe(
		"signal-collections-effect.ts",
		async ({ createFiniteSeries, createSeriesTotal, observeSeriesTotal, replaceFiniteSeries }) => {
			const sparse = [1, 2, 3];

			delete sparse[1];
			assert.throws(() => createFiniteSeries(null), TypeError);
			assert.throws(() => createFiniteSeries(sparse), TypeError);
			assert.throws(() => createFiniteSeries([1, Number.POSITIVE_INFINITY]), TypeError);

			const series = createFiniteSeries([1, 2]);
			const observed = [];
			const dispose = observeSeriesTotal(series, (total) => observed.push(total));

			assert.deepEqual(observed, [3]);
			replaceFiniteSeries(series, [3, 4]);
			assert.deepEqual(observed, [3]);
			await Promise.resolve();
			assert.deepEqual(observed, [3, 7]);
			assert.throws(() => replaceFiniteSeries(series, [8, Number.NaN]), TypeError);
			assert.deepEqual([...series], [3, 4]);

			dispose();
			const total = createSeriesTotal(series);

			delete series[0];
			assert.throws(() => total.get(), TypeError);
		},
	);
});

test("client-messaging recipe transfers ownership, delivers subscriptions, cancels work, and closes ports", async () => {
	await withRecipe(
		"client-messaging.ts",
		async ({ collectSequence, openLocalMessageSession, requestTransferredCopy }) => {
			let aborted = 0;
			let cleaned = 0;
			const session = openLocalMessageSession({
				onRequestAbort: () => ++aborted,
				onSubscriptionCleanup: () => ++cleaned,
			});

			try {
				await session.client.ready;

				const input = new Uint8Array([2, 4, 6]).buffer;
				const response = requestTransferredCopy(session.client, input);

				assert.equal(input.byteLength, 0);
				assert.deepEqual([...new Uint8Array(await response)], [2, 4, 6]);
				assert.deepEqual(await collectSequence(session.client, { start: 5, count: 3 }), [5, 6, 7]);
				await Promise.resolve();
				assert.equal(cleaned, 1);

				const subscriptionController = new AbortController();
				const subscriptionReason = new Error("subscription already cancelled");

				subscriptionController.abort(subscriptionReason);
				await assert.rejects(
					collectSequence(session.client, { start: 0, count: 1 }, { signal: subscriptionController.signal }),
					(error) => error === subscriptionReason,
				);

				const controller = new AbortController();
				const pending = session.client.request("wait", 1_000, { signal: controller.signal });
				const reason = new Error("stop waiting");

				await new Promise((resolve) => setTimeout(resolve, 10));
				controller.abort(reason);
				await assert.rejects(pending, (error) => error === reason);
				await new Promise((resolve) => setTimeout(resolve, 10));
				assert.equal(aborted, 1);
			} finally {
				session.close();
			}

			await Promise.all([session.client.closed, session.server.closed]);
		},
	);
});

test("arraybuffer-base64 recipe distinguishes omitted options and preserves view boundaries", async () => {
	await withRecipe("arraybuffer-base64-node.ts", async ({ encodeBytes, encodeUTF8, normalizeBase64Options }) => {
		assert.deepEqual(normalizeBase64Options(), {});
		assert.throws(() => normalizeBase64Options(null), TypeError);
		assert.throws(() => normalizeBase64Options({ omitPadding: 1 }), TypeError);
		assert.throws(() => normalizeBase64Options({ alphabet: "hex" }), TypeError);

		const storage = new Uint8Array([99, 251, 255, 88]);
		const view = new Uint8Array(storage.buffer, 1, 2);

		assert.equal(encodeBytes(view), "+/8=");
		assert.equal(encodeBytes(view, { alphabet: "base64url", omitPadding: true }), "-_8");
		assert.equal(encodeUTF8("hello"), "aGVsbG8=");
	});
});

test("resource recipe preserves LIFO cleanup and the acquisition/work/cleanup error tree", async () => {
	await withRecipe("resource-management.ts", async ({ runResourceScope, ScopedResources, resourceSymbols }) => {
		const order = [];
		const result = await runResourceScope((scope) => {
			scope.defer(() => order.push("defer"));
			scope.adopt("value", () => order.push("adopt"));
			scope.use({ [resourceSymbols.dispose]: () => order.push("use") });

			return 42;
		});

		assert.equal(result, 42);
		assert.deepEqual(order, ["use", "adopt", "defer"]);

		const firstCleanup = new Error("first cleanup");
		const secondCleanup = new Error("second cleanup");
		const acquisition = new Error("acquisition failed");

		await assert.rejects(
			runResourceScope((scope) => {
				scope.defer(() => {
					throw firstCleanup;
				});
				scope.defer(async () => {
					throw secondCleanup;
				});
				throw acquisition;
			}),
			(error) => {
				assert.equal(error.name, "SuppressedError");
				assert.equal(error.error, firstCleanup);
				assert.equal(error.suppressed.name, "SuppressedError");
				assert.equal(error.suppressed.error, secondCleanup);
				assert.equal(error.suppressed.suppressed, acquisition);

				return true;
			},
		);

		const single = new Error("single cleanup");
		const scope = new ScopedResources();

		scope.use(null);
		scope.defer(() => {
			throw single;
		});
		await assert.rejects(scope.disposeAsync(), (error) => error === single);
	});
});

test("dormant effect recipe covers synchronous start, scheduled changes, disabled publication, and disposal", async () => {
	const { Signal } = await import("@serve-tools/signal");

	await withRecipe("dormant-signal-effects.ts", async ({ createGatedEffect, normalizeInitialEnabled }) => {
		assert.equal(normalizeInitialEnabled(), true);
		assert.equal(normalizeInitialEnabled(false), false);
		assert.throws(() => normalizeInitialEnabled(null), TypeError);

		const source = new Signal.State("initial");
		const events = [];
		const controller = createGatedEffect(
			() => events.push(`enabled:${source.get()}`),
			() => events.push("disabled"),
		);

		assert.deepEqual(events, []);
		controller.start();
		assert.deepEqual(events, ["enabled:initial"]);

		source.set("scheduled");
		assert.deepEqual(events, ["enabled:initial"]);
		await Promise.resolve();
		assert.deepEqual(events, ["enabled:initial", "enabled:scheduled"]);

		controller.setEnabled(false);
		await Promise.resolve();
		assert.deepEqual(events, ["enabled:initial", "enabled:scheduled", "disabled"]);

		source.set("while-disabled");
		await Promise.resolve();
		assert.deepEqual(events, ["enabled:initial", "enabled:scheduled", "disabled"]);

		controller.setEnabled(true);
		await Promise.resolve();
		assert.deepEqual(events, ["enabled:initial", "enabled:scheduled", "disabled", "enabled:while-disabled"]);

		source.set("disposed-before-flush");
		controller.dispose();
		await Promise.resolve();
		assert.equal(events.includes("enabled:disposed-before-flush"), false);

		const initiallyDisabled = [];
		const disabled = createGatedEffect(
			() => initiallyDisabled.push("enabled"),
			() => initiallyDisabled.push("disabled"),
			false,
		);

		disabled.start();
		assert.deepEqual(initiallyDisabled, ["disabled"]);
		disabled.dispose();
	});
});
