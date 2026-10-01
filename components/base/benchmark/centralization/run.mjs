import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const directory = resolve(process.argv[2]);
const metadata = JSON.parse(await readFile(`${directory}/sizes.json`, "utf8"));
const browser = await chromium.launch({ headless: true });
try {
	for (const consumer of ["base", "checkbox", "number"]) {
		const page = await browser.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto("about:blank");
		await page.addScriptTag({ path: `${directory}/${consumer}.min.js` });
		const result = await page.evaluate((name) => {
			const iterations = 10_000;
			let clockQuantum = Infinity;
			for (let index = 0; index < 20; ++index) {
				const started = performance.now();
				let elapsed = 0;
				while (elapsed === 0) {
					elapsed = performance.now() - started;
				}
				clockQuantum = Math.min(clockQuantum, elapsed);
			}
			const samples = [];
			let sink;
			for (let sample = -10; sample < 30; ++sample) {
				const started = performance.now();
				for (let index = 0; index < iterations; ++index) {
					sink = document.createElement("measure-0");
				}
				const elapsed = performance.now() - started;
				if (sample >= 0) {
					samples.push(elapsed);
				}
			}
			if (!(sink instanceof customElements.get("measure-0")) || sink.isConnected) {
				throw new Error("Construction benchmark did not create the registered disconnected element");
			}
			if (name === "checkbox" && (sink.checked !== false || sink.form !== null)) {
				throw new Error("Checkbox initial state changed");
			}
			if (name === "number" && (sink.input !== null || sink.validity !== null)) {
				throw new Error("Native field initial state changed");
			}
			const sorted = [...samples].sort((left, right) => left - right);
			if (sorted[0] < clockQuantum * 20) {
				throw new Error("Construction samples did not clear twenty observed clock quanta");
			}
			return {
				name: `base-construction/${name}-10000`,
				iterations,
				clockQuantum,
				samples,
				medianMilliseconds: (sorted[14] + sorted[15]) / 2,
				p95Milliseconds: sorted[Math.ceil(sorted.length * 0.95) - 1],
			};
		}, consumer);
		if (errors.length) {
			throw new Error(errors.join("\n"));
		}
		console.log(
			`[benchmark] ${JSON.stringify({ ...result, build: metadata.consumers[consumer], browser: browser.version() })}`,
		);
		await page.close();
	}
} finally {
	await browser.close();
}
