import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const directory = resolve(process.argv[2] ?? "");
const mode = process.argv[3];
if (!process.argv[2] || !["--smoke", "--timing", "--memory"].includes(mode)) {
	throw new Error("Pass a reduction measurement directory and --smoke, --timing, or --memory");
}
const metadata = JSON.parse(await readFile(`${directory}/sizes.json`, "utf8"));
const code = await readFile(`${directory}/full-library.standalone.min.js`, "utf8");
const bundle = metadata.entries["full-library"].standalone;
if (Buffer.byteLength(code) !== bundle.bytes || createHash("sha256").update(code).digest("hex") !== bundle.sha256) {
	throw new Error("Bundle does not match metadata");
}
const workloads =
	mode === "--memory"
		? ["base", "option", "checkbox"]
		: [
				"construct-base",
				"construct-option",
				"construct-checkbox",
				"lifecycle-base",
				"lifecycle-checkbox",
				"reconnect-checkbox",
				"update-checkbox",
			];
const browser = await chromium.launch({ headless: true });
try {
	for (const workload of workloads) {
		const page = await browser.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") {
				errors.push(message.text());
			}
		});
		await page.route("https://foundation.invalid/**", (route) =>
			route.fulfill({
				contentType: route.request().url().endsWith("library.js") ? "text/javascript" : "text/html",
				body: route.request().url().endsWith("library.js") ? code : "<!doctype html><body></body>",
				headers: {
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp",
				},
			}),
		);
		await page.goto("https://foundation.invalid/");
		await page.evaluate(async () => {
			const url = "https://foundation.invalid/library.js";
			const library = await import(url);
			for (const name of ["Base", "Option", "Checkbox"]) {
				customElements.define(`perf-${name.toLowerCase()}`, class extends library[`${name}Element`] {});
			}
		});
		if (mode === "--memory") {
			const session = await page.context().newCDPSession(page);
			await session.send("HeapProfiler.collectGarbage");
			const before = await session.send("Runtime.getHeapUsage");
			await page.evaluate((name) => {
				globalThis.retained = Array.from({ length: 10000 }, () => document.createElement(`perf-${name}`));
				if (globalThis.retained.some((element) => element.isConnected)) {
					throw new Error("Unexpected connection");
				}
			}, workload);
			await session.send("HeapProfiler.collectGarbage");
			const retained = await session.send("Runtime.getHeapUsage");
			await page.evaluate(() => {
				globalThis.retained = undefined;
			});
			await session.send("HeapProfiler.collectGarbage");
			const released = await session.send("Runtime.getHeapUsage");
			console.log(
				JSON.stringify({
					name: `foundation/memory-${workload}`,
					count: 10000,
					before,
					retained,
					released,
					retainedJSBytes: retained.usedSize - before.usedSize,
					releasedJSBytes: released.usedSize - before.usedSize,
				}),
			);
		} else {
			const result = await page.evaluate(
				async ({ workload, smoke }) => {
					const [kind, name] = workload.split("-");
					const tag = `perf-${name}`;
					const root = document.createElement("div");
					document.body.append(root);
					const retained = document.createElement(tag);
					if (kind === "reconnect" || kind === "update") {
						root.append(retained);
						if (kind === "reconnect") {
							retained.remove();
						}
					}
					let sink;
					const operation = () => {
						if (kind === "construct") {
							sink = document.createElement(tag);
						} else if (kind === "lifecycle") {
							const element = document.createElement(tag);
							root.append(element);
							element.remove();
							sink = element;
						} else if (kind === "reconnect") {
							root.append(retained);
							retained.remove();
						} else {
							retained.checked = !retained.checked;
						}
					};
					operation();
					const verify = () => {
						if (kind === "construct" || kind === "lifecycle") {
							if (!(sink instanceof customElements.get(tag)) || sink.isConnected) {
								throw new Error("Construction identity");
							}
							if (name === "checkbox" && (sink.checked || sink.form !== null)) {
								throw new Error("Checkbox defaults");
							}
						} else if (kind === "reconnect" && retained.isConnected) {
							throw new Error("Reconnect teardown");
						} else if (kind === "update" && retained.checked !== retained.matches(":state(checked)")) {
							throw new Error("Checkbox state");
						}
					};
					verify();
					if (smoke) {
						return null;
					}
					const iterations = kind === "construct" ? 100000 : kind === "update" ? 10000 : 1000;
					let quantum = Infinity;
					for (let index = 0; index < 20; ++index) {
						const start = performance.now();
						let end = start;
						while (end === start) {
							end = performance.now();
						}
						quantum = Math.min(quantum, end - start);
					}
					const durations = [];
					for (let sample = -5; sample < 30; ++sample) {
						const start = performance.now();
						for (let index = 0; index < iterations; ++index) {
							operation();
						}
						await Promise.resolve();
						await Promise.resolve();
						const duration = performance.now() - start;
						verify();
						if (sample >= 0) {
							if (duration < quantum * 20) {
								throw new Error(`Timer precision: ${workload}`);
							}
							durations.push(duration);
						}
					}
					const sorted = durations.toSorted((a, b) => a - b);
					return {
						name: `foundation/${workload}`,
						iterations,
						samples: durations.length,
						durations,
						quantum,
						medianMilliseconds: (sorted[14] + sorted[15]) / 2,
						p95Milliseconds: sorted[28],
						meanMilliseconds: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
					};
				},
				{ workload, smoke: mode === "--smoke" },
			);
			if (result) {
				console.log(`[benchmark] ${JSON.stringify(result)}`);
			}
		}
		if (errors.length) {
			throw new Error(errors.join("\n"));
		}
		await page.close();
	}
	console.log(
		JSON.stringify({
			mode,
			directory,
			bundle,
			browser: browser.version(),
			node: process.version,
			cpu: cpus()[0].model,
			platform: platform(),
			release: release(),
		}),
	);
} finally {
	await browser.close();
}
