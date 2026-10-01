import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const directory = resolve(process.argv[2] ?? "");
const smoke = process.argv[3] === "--smoke";
if (!process.argv[2] || (!smoke && process.argv[3] !== "--confirmed-quiet-slot")) {
	throw new Error("Pass a measurement directory and --smoke or --confirmed-quiet-slot");
}
const metadata = JSON.parse(await readFile(`${directory}/sizes.json`, "utf8"));
const code = await readFile(`${directory}/full-library.standalone.min.js`, "utf8");
const expected = metadata.entries["full-library"].standalone;
if (Buffer.byteLength(code) !== expected.bytes || createHash("sha256").update(code).digest("hex") !== expected.sha256) {
	throw new Error("Bundle does not match its measurement metadata");
}
const browser = await chromium.launch({ headless: true });
try {
	for (const workload of [
		"calendar-month",
		"field-refresh",
		"select-100-options",
		"create-checkbox",
		"create-option",
		"construct-checkbox",
		"construct-option",
	]) {
		const page = await browser.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") {
				errors.push(message.text());
			}
		});
		await page.route("https://reduction.invalid/**", (route) =>
			route.fulfill({
				contentType: route.request().url().endsWith("library.js") ? "text/javascript" : "text/html",
				body: route.request().url().endsWith("library.js") ? code : "<!doctype html><body></body>",
			}),
		);
		await page.goto("https://reduction.invalid/");
		const results = await page.evaluate(
			async ({ smoke, workload }) => {
				const library = await import("https://reduction.invalid/library.js");
				for (const name of ["Calendar", "Checkbox", "Field", "Option", "Select"]) {
					customElements.define(`bench-${name.toLowerCase()}`, class extends library[`${name}Element`] {});
				}
				const field = document.createElement("bench-field");
				const input = document.createElement("input");
				input.slot = "control";
				field.append(input);
				document.body.append(field);
				const calendar = document.createElement("bench-calendar");
				calendar.locale = "en-US";
				calendar.month = "2026-01";
				document.body.append(calendar);
				const select = document.createElement("bench-select");
				const trigger = document.createElement("button");
				const popup = document.createElement("div");
				popup.popover = "manual";
				const options = Array.from({ length: 100 }, (_, index) => {
					const option = document.createElement("bench-option");
					option.value = String(index);
					option.textContent = `Option ${index}`;
					return option;
				});
				popup.append(...options);
				select.append(trigger, popup);
				document.body.append(select);
				let month = 0;
				let value = 0;
				let sink;
				const workloads = [
					[
						"reduction/calendar-month",
						50,
						() => {
							calendar.month = ++month % 2 ? "2026-02" : "2026-01";
							if (calendar.shadowRoot.querySelectorAll('[role="gridcell"]').length !== 42) {
								throw new Error("Calendar grid");
							}
						},
					],
					[
						"reduction/field-refresh",
						5000,
						() => {
							input.value = ++value % 2 ? "value" : "";
							field.refresh();
							if (field.filled !== Boolean(input.value)) {
								throw new Error("Field state");
							}
						},
					],
					[
						"reduction/select-100-options",
						100,
						() => {
							select.value = String(++value % 100);
							if (select.value !== String(value % 100) || !options[value % 100].selected) {
								throw new Error("Selection state");
							}
						},
					],
					...["checkbox", "option"].map((name) => [
						`reduction/create-${name}`,
						5000,
						() => {
							const element = document.createElement(`bench-${name}`);
							element.disabled = true;
							if (!element.disabled || !element.hasAttribute("disabled")) {
								throw new Error("Disabled reflection");
							}
						},
					]),
				];
				for (const name of ["checkbox", "option"]) {
					workloads.push([
						`reduction/construct-${name}`,
						10000,
						() => {
							sink = document.createElement(`bench-${name}`);
						},
					]);
				}
				let quantum = Infinity;
				for (let index = 0; index < 20; ++index) {
					const start = performance.now();
					let end = start;
					while (end === start) {
						end = performance.now();
					}
					quantum = Math.min(quantum, end - start);
				}
				const results = [];
				for (const [name, iterations, operation] of workloads) {
					if (name !== `reduction/${workload}`) {
						continue;
					}
					operation();
					if (smoke) {
						continue;
					}
					const durations = [];
					for (let sample = -5; sample < 30; ++sample) {
						const start = performance.now();
						for (let iteration = 0; iteration < iterations; ++iteration) {
							operation();
						}
						await Promise.resolve();
						await Promise.resolve();
						const duration = performance.now() - start;
						if (sample >= 0) {
							if (duration < quantum * 20) {
								throw new Error(`Timer resolution: ${name}`);
							}
							durations.push(duration);
						}
					}
					const sorted = durations.toSorted((left, right) => left - right);
					results.push({
						name,
						iterations,
						samples: durations.length,
						durations,
						quantum,
						meanMilliseconds: durations.reduce((sum, item) => sum + item, 0) / durations.length,
						medianMilliseconds: sorted[14],
						p95Milliseconds: sorted[28],
					});
				}
				if (
					sink &&
					!(sink instanceof library[workload.endsWith("checkbox") ? "CheckboxElement" : "OptionElement"])
				) {
					throw new Error("Construction identity");
				}
				return results;
			},
			{ smoke, workload },
		);
		if (errors.length) {
			throw new Error(errors.join("\n"));
		}
		for (const result of results) {
			console.log(`[benchmark] ${JSON.stringify(result)}`);
		}
		await page.close();
	}
	console.log(
		JSON.stringify({
			browser: browser.version(),
			node: process.version,
			platform: platform(),
			release: release(),
			cpu: cpus()[0].model,
			bundle: metadata.entries["full-library"].standalone,
			smoke,
		}),
	);
} finally {
	await browser.close();
}
