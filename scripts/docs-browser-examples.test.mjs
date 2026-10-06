import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rolldown } from "rolldown";
import { selectIntroductoryExample, selectIntroductoryExamples } from "./docs-examples.mjs";
import { createPagesPreview } from "./preview-pages.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const recipes = [
	{ name: "storage", location: "client/storage", exports: "storage" },
	{ name: "signal-storage", location: "client-signals/storage", exports: "storage, theme" },
	{ name: "signal-db", location: "client-signals/db", exports: "db, note, output" },
	{ name: "signal-dom", location: "client-signals/dom", exports: "greeting, paragraph" },
	{ name: "context", location: "client/context", exports: "provider, consumer, label" },
	{ name: "messaging", location: "client/messaging", exports: "worker, output, totals" },
];

/** Compile the exact README fences; the appended export only exposes their existing objects to assertions. */
async function buildExamples(directory) {
	const files = [];
	for (const recipe of recipes) {
		const markdown = await readFile(path.join(root, recipe.location, "README.md"), "utf8");
		const blocks = selectIntroductoryExamples(markdown);
		const example =
			recipe.name === "messaging"
				? blocks.find(({ code }) => code.startsWith("// page.ts"))
				: selectIntroductoryExample(markdown);
		if (recipe.name === "messaging") {
			const worker = blocks.find(({ code }) => code.startsWith("// counter-worker.ts"));
			assert.ok(worker);
			const workerFile = `source/${recipe.name}/counter-worker.ts`;
			files.push(workerFile);
			await mkdir(path.dirname(path.join(directory, workerFile)), { recursive: true });
			await writeFile(path.join(directory, workerFile), worker.code);
		}
		assert.equal(example?.language, "ts", recipe.location);
		const filename = `source/${recipe.name}/example.ts`;
		files.push(filename);
		await mkdir(path.dirname(path.join(directory, filename)), { recursive: true });
		await writeFile(
			path.join(directory, filename),
			`${example.code}\n// Test instrumentation: expose existing README objects without changing the recipe.\nexport const fixture = { ${recipe.exports} };\n`,
		);
	}
	await writeFile(
		path.join(directory, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				strict: true,
				exactOptionalPropertyTypes: true,
				module: "esnext",
				moduleResolution: "bundler",
				target: "es2022",
				lib: ["ES2025", "DOM", "DOM.Iterable", "ESNext.Disposable"],
				types: [],
				skipLibCheck: true,
				rootDir: "source",
				outDir: "compiled",
			},
			files,
		}),
	);
	const compiler = spawnSync(
		process.execPath,
		[
			path.join(root, "node_modules/typescript/bin/tsc"),
			"--project",
			path.join(directory, "tsconfig.json"),
			"--pretty",
			"false",
		],
		{ encoding: "utf8" },
	);
	assert.equal(compiler.status, 0, `${compiler.stdout}${compiler.stderr}`);
	for (const recipe of recipes) {
		const output = path.join(directory, "site", recipe.name);
		await mkdir(output, { recursive: true });
		const bundle = await rolldown({
			input: path.join(directory, "compiled", recipe.name, "example.js"),
			platform: "browser",
		});
		try {
			await bundle.write({ file: path.join(output, "example.js"), format: "esm" });
		} finally {
			await bundle.close();
		}
		if (recipe.name === "messaging") {
			const workerBundle = await rolldown({
				input: path.join(directory, "compiled", recipe.name, "counter-worker.js"),
				platform: "browser",
			});
			try {
				await workerBundle.write({ file: path.join(output, "counter-worker.js"), format: "esm" });
			} finally {
				await workerBundle.close();
			}
		}
		await writeFile(
			path.join(output, "index.html"),
			'<!doctype html><html><head><meta charset="utf-8"><title>README regression</title></head><body><script type="module">import { fixture } from "./example.js"; globalThis.readme = fixture;</script></body></html>',
		);
	}
}

test("authored browser introductions initialize, update, and release their owned views", {
	timeout: 120_000,
}, async (t) => {
	await mkdir(path.join(root, "dist"), { recursive: true });
	const directory = await mkdtemp(path.join(root, "dist/docs-browser-examples-"));
	let server;
	let browser;
	try {
		await buildExamples(directory);
		server = createPagesPreview(path.join(directory, "site"));
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const origin = `http://127.0.0.1:${server.address().port}`;
		browser = await chromium.launch();
		for (const recipe of recipes) {
			await t.test(recipe.name, async () => {
				const context = await browser.newContext();
				const errors = [];
				context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
				try {
					const page = await context.newPage();
					await page.goto(`${origin}/${recipe.name}/`);
					await page.waitForFunction(() => Boolean(globalThis.readme));
					if (recipe.name === "storage" || recipe.name === "signal-storage") {
						await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
						const other = await context.newPage();
						await other.goto(`${origin}/${recipe.name}/`);
						await other.waitForFunction(() => Boolean(globalThis.readme));
						await other.evaluate(() => globalThis.readme.storage.set("theme", "light"));
						await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
						await other.waitForFunction(() => document.documentElement.dataset.theme === "light");
						await page.evaluate(() => dispatchEvent(new Event("pagehide")));
						await page.evaluate(() => {
							globalThis.nextStorageEvent = new Promise((resolve) =>
								addEventListener(
									"storage",
									() => requestAnimationFrame(() => requestAnimationFrame(resolve)),
									{ once: true },
								),
							);
						});
						await other.evaluate(() => globalThis.readme.storage.set("theme", "dark"));
						await page.evaluate(() => globalThis.nextStorageEvent);
						await other.waitForFunction(() => document.documentElement.dataset.theme === "dark");
						assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
					} else if (recipe.name === "signal-db") {
						await page.waitForFunction(() => document.querySelector("output")?.value === "Hello, Ada!");
						assert.equal(
							await page.evaluate(() => globalThis.readme.db.get("notes", "welcome")),
							"Hello, Ada!",
						);
						await page.evaluate(() =>
							globalThis.readme.db.put("notes", "Hello, Grace!", { key: "welcome" }),
						);
						await page.waitForFunction(() => document.querySelector("output")?.value === "Hello, Grace!");
						await page.evaluate(() => dispatchEvent(new Event("pagehide")));
						assert.equal(await page.evaluate(() => globalThis.readme.note.get().value), "Hello, Grace!");
					} else if (recipe.name === "signal-dom") {
						assert.equal(await page.locator("p").textContent(), "Ahoy");
						await page.evaluate(() => {
							globalThis.originalText = globalThis.readme.paragraph.firstChild;
							globalThis.readme.greeting.set("Hello again");
						});
						await page.waitForFunction(() => document.querySelector("p")?.textContent === "Hello again");
						assert.ok(
							await page.evaluate(
								() =>
									globalThis.readme.paragraph === document.querySelector("p") &&
									globalThis.originalText === document.querySelector("p").firstChild,
							),
						);
						await page.evaluate(() => {
							dispatchEvent(new Event("pagehide"));
							globalThis.readme.greeting.set("Model survives");
						});
						assert.equal(await page.evaluate(() => globalThis.readme.greeting.get()), "Model survives");
						assert.equal(await page.locator("p").textContent(), "Hello again");
					} else if (recipe.name === "messaging") {
						await page.waitForFunction(() => document.querySelector("output")?.value === "2");
						const other = await context.newPage();
						await other.goto(`${origin}/${recipe.name}/`);
						await other.waitForFunction(() => Boolean(globalThis.readme));
						await page.waitForFunction(() => document.querySelector("output")?.value === "4");
						await other.waitForFunction(() => document.querySelector("output")?.value === "4");
						assert.equal(
							await other.evaluate(() => globalThis.readme.worker.client.request("increment", 3)),
							7,
						);
						await page.waitForFunction(() => document.querySelector("output")?.value === "7");
						await other.waitForFunction(() => document.querySelector("output")?.value === "7");
						await page.evaluate(() => dispatchEvent(new Event("pagehide")));
						assert.equal(
							await other.evaluate(() => globalThis.readme.worker.client.request("increment", 1)),
							8,
						);
						await other.waitForFunction(() => document.querySelector("output")?.value === "8");
						assert.equal(await page.locator("output").textContent(), "7");
					} else if (recipe.name === "context") {
						assert.equal(await page.locator("p").textContent(), "Theme: dark");
						await page.evaluate(() => globalThis.readme.provider.setValue("light"));
						assert.equal(await page.locator("p").textContent(), "Theme: light");
						await page.evaluate(() => {
							dispatchEvent(new Event("pagehide"));
							globalThis.readme.provider.setValue("dark");
						});
						assert.equal(await page.locator("p").textContent(), "Theme: light");
					}
					assert.deepEqual(errors, []);
				} finally {
					await context.close();
				}
			});
		}
	} finally {
		await browser?.close();
		if (server) {
			await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		}
		await rm(directory, { recursive: true, force: true });
	}
});
