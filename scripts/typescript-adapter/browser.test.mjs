import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "vite";
import { createBrowserFixture } from "./browser-fixture.mjs";
import { typescriptProject } from "./plugin.mjs";

for (const [engine, browserType] of [
	["Chromium", chromium],
	["Firefox", firefox],
	["WebKit", webkit],
]) {
	test(`Vite serves compiler output and recovers HMR in ${engine}`, { timeout: 90_000 }, async (t) => {
		await runBrowserAcceptance(t, browserType);
	});
}

async function runBrowserAcceptance(t, browserType) {
	const fixture = await createBrowserFixture();
	let browser;
	let page;
	let plugin;
	let server;
	const browserErrors = [];
	const pageErrors = [];

	t.after(async () => {
		await page?.close();
		await browser?.close();
		await server?.close();
		await plugin?.api.dispose();
		await fixture.dispose();
	});

	await fixture.assertNoDist();
	plugin = await typescriptProject({ configFile: fixture.configFile, cwd: fixture.root });
	server = await createServer({
		appType: "spa",
		configFile: false,
		plugins: [plugin],
		root: fixture.root,
		server: {
			forwardConsole: true,
			host: "127.0.0.1",
			port: 0,
			strictPort: false,
		},
	});
	await server.listen();
	for (const name of ["@fixture/a", "@fixture/b", "@fixture/c"]) {
		assert.ok(
			server.config.optimizeDeps.exclude?.includes(name),
			`${name} was not excluded from dependency optimization`,
		);
	}

	const address = server.httpServer.address();
	assert.ok(address && typeof address === "object", "Vite did not expose its loopback address");
	const origin = `http://127.0.0.1:${address.port}`;
	browser = await browserType.launch({ headless: true });
	page = await browser.newPage();
	page.on("console", (message) => {
		if (message.type() === "error") {
			browserErrors.push(message.text());
		}
	});
	page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));

	await page.goto(origin, { waitUntil: "networkidle" });
	await assertBrowserState(page, { asset: "prepared asset", decorator: "decorated", result: 10 }, 1);
	await fixture.assertNoDist();
	assert.equal(pageErrors.length, 0, pageErrors.join("\n"));

	const sourceMap = await findDependencySourceMap(page, server, "/c/dist/index.js");
	const generatedPosition = findGeneratedPosition(sourceMap.code, 'throw new Error("mapped failure")');
	const originalPosition = originalPositionFor(sourceMap.map, generatedPosition.line, generatedPosition.column);
	assert.ok(originalPosition, "Compiler source map did not map the generated throw statement");
	assert.equal(
		path.resolve(fixture.root, "c/dist", originalPosition.source),
		fixture.dependency,
		`Unexpected mapped source ${originalPosition.source}; map sources: ${sourceMap.map.sources.join(", ")}`,
	);
	assert.equal(originalPosition.line, fixture.mappedLine);
	assert.ok(sourceMap.map.sourcesContent?.some((source) => source?.includes('throw new Error("mapped failure")')));

	await fixture.writeStaleDist();
	await fixture.writeDependency(7);
	await assertBrowserState(page, { asset: "prepared asset", decorator: "decorated", result: 50 }, 2);

	await fixture.writeCompilerError();
	await page.waitForFunction(
		() => document.querySelector("vite-error-overlay")?.shadowRoot?.textContent?.includes("TS2322"),
		undefined,
		{ timeout: 10_000 },
	);
	assert.deepEqual(await page.evaluate(() => window.__typescriptAdapter.result), 50);

	await fixture.writeDependency(9);
	await assertBrowserState(page, { asset: "prepared asset", decorator: "decorated", result: 82 }, 3);
	await page.waitForFunction(() => !document.querySelector("vite-error-overlay"), undefined, { timeout: 10_000 });

	const concurrentStart = await browserHistory(page);
	await Promise.all([fixture.writeImporter(2), fixture.writeDependency(10)]);
	await assertBrowserState(
		page,
		{ asset: "prepared asset", decorator: "decorated", result: 102 },
		concurrentStart.generation + 1,
	);
	const concurrentHistory = (await browserHistory(page)).results.slice(concurrentStart.length);
	assert.ok(concurrentHistory.length > 0, "Concurrent importer and dependency edits produced no HMR state");
	assert.ok(
		concurrentHistory.every((result) => result === 82 || result === 102),
		`Concurrent edits exposed a mixed compiler generation: ${concurrentHistory.join(", ")}`,
	);

	const rapidStart = await browserHistory(page);
	await fixture.writeDependency(11);
	await fixture.writeDependency(12);
	await assertBrowserState(
		page,
		{ asset: "prepared asset", decorator: "decorated", result: 146 },
		rapidStart.generation + 1,
	);
	const rapidHistory = (await browserHistory(page)).results.slice(rapidStart.length);
	assert.ok(rapidHistory.length > 0, "Rapid dependency edits produced no HMR state");
	assert.ok(
		rapidHistory.every((result) => result === 102 || result === 123 || result === 146),
		`Rapid edits exposed a mixed compiler generation: ${rapidHistory.join(", ")}`,
	);
	assert.equal(rapidHistory.at(-1), 146);

	assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
	assert.ok(
		browserErrors.every((message) => message.includes("TS2322") || message.includes("[vite]")),
		`Unexpected browser console errors:\n${browserErrors.join("\n")}`,
	);
	assert.equal(plugin.api.error == null, true);
	assert.ok(plugin.api.generation.generation >= 5);

	await page.close();
	await browser.close();
	await server.close();
	await plugin.api.dispose();
	await assert.rejects(plugin.api.refresh(), /disposed/);
}

async function browserHistory(page) {
	return page.evaluate(() => ({
		generation: window.__typescriptAdapter.generation,
		length: window.__typescriptAdapterHistory.length,
		results: window.__typescriptAdapterHistory.map(({ result }) => result),
	}));
}

async function assertBrowserState(page, expected, minimumGeneration) {
	try {
		await page.waitForFunction(
			({ expectedState, minimumGeneration }) => {
				const actual = window.__typescriptAdapter;
				return (
					actual &&
					actual.generation >= minimumGeneration &&
					Object.entries(expectedState).every(([key, value]) => actual[key] === value)
				);
			},
			{ expectedState: expected, minimumGeneration },
			{ timeout: 10_000 },
		);
	} catch (error) {
		const actual = await page.evaluate(() => ({
			overlay: document.querySelector("vite-error-overlay")?.shadowRoot?.textContent,
			state: window.__typescriptAdapter,
		}));
		throw new Error(
			`${error.message}\nExpected browser state: ${JSON.stringify(expected)}\nActual browser state: ${JSON.stringify(actual)}`,
			{ cause: error },
		);
	}
	const actual = await page.evaluate(() => window.__typescriptAdapter);
	assert.ok(actual.generation >= minimumGeneration);
	for (const [key, value] of Object.entries(expected)) {
		assert.deepEqual(actual[key], value, key);
	}
}

async function findDependencySourceMap(page, server, suffix) {
	const urls = await page.evaluate(() => performance.getEntriesByType("resource").map(({ name }) => name));
	const url = urls.find((candidate) => new URL(candidate).pathname.endsWith(suffix));
	assert.ok(url, `Browser did not load an emitted module ending in ${suffix}:\n${urls.join("\n")}`);
	const transformed = await server.transformRequest(new URL(url).pathname);
	assert.ok(transformed, `Vite could not transform ${url}`);
	assert.ok(transformed.map && typeof transformed.map === "object", `Vite returned no source map for ${url}`);
	return { code: transformed.code, map: transformed.map };
}

function findGeneratedPosition(code, needle) {
	const index = code.indexOf(needle);
	assert.notEqual(index, -1, `Generated output does not contain ${needle}`);
	const before = code.slice(0, index);
	const lines = before.split("\n");
	return { column: lines.at(-1).length, line: lines.length };
}

function originalPositionFor(map, targetLine, targetColumn) {
	const state = { originalColumn: 0, originalLine: 0, source: 0 };
	const lines = map.mappings.split(";");
	for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
		let generatedColumn = 0;
		let candidate;
		for (const encoded of lines[lineIndex].split(",")) {
			if (!encoded) {
				continue;
			}
			const values = decodeVlq(encoded);
			generatedColumn += values[0];
			if (values.length < 4) {
				continue;
			}
			state.source += values[1];
			state.originalLine += values[2];
			state.originalColumn += values[3];
			if (lineIndex + 1 === targetLine && generatedColumn <= targetColumn) {
				candidate = {
					column: state.originalColumn,
					line: state.originalLine + 1,
					source: map.sources[state.source],
				};
			}
		}
		if (lineIndex + 1 === targetLine) {
			return candidate;
		}
	}
}

function decodeVlq(encoded) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	const values = [];
	let shift = 0;
	let value = 0;
	for (const character of encoded) {
		const digit = alphabet.indexOf(character);
		assert.notEqual(digit, -1, `Invalid source-map VLQ digit ${character}`);
		value += (digit & 31) << shift;
		if (digit & 32) {
			shift += 5;
			continue;
		}
		const negative = value & 1;
		values.push((negative ? -1 : 1) * (value >> 1));
		shift = 0;
		value = 0;
	}
	assert.equal(shift, 0, `Unterminated source-map VLQ segment ${encoded}`);
	return values;
}
