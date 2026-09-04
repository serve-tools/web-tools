import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const smoke = process.argv[2] === "--smoke";
if ((!smoke && process.argv[2] !== "--confirmed-quiet-slot") || !process.argv[3]) {
	throw new Error(
		"Pass --smoke or, in a quiet measurement window, --confirmed-quiet-slot <build metadata> [--workload <name>]",
	);
}

const workloadIndex = process.argv.indexOf("--workload");
const workload = workloadIndex === -1 ? undefined : process.argv[workloadIndex + 1];
if (workloadIndex !== -1 && workload === undefined) {
	throw new Error("Pass a workload name after --workload");
}

const build = JSON.parse(await readFile(process.argv[3], "utf8"));
const bundle = await readFile(build.bundle.path, "utf8");
const browser = await chromium.launch({ headless: true });

try {
	const context = await browser.newContext();
	await context.route("https://lazy-effect-benchmark.invalid/", async (route) => {
		await route.fulfill({
			body: "<!doctype html><html><body></body></html>",
			contentType: "text/html",
			status: 200,
		});
	});
	const page = await context.newPage();
	const errors = [];
	const results = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			errors.push(`console: ${message.text()}`);
		} else if (message.text().startsWith("[benchmark] ")) {
			console.log(message.text());
			results.push(JSON.parse(message.text().slice("[benchmark] ".length)));
		}
	});
	page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
	await page.goto("https://lazy-effect-benchmark.invalid/");
	await page.addScriptTag({ content: bundle });
	if (smoke) {
		await page.evaluate(() => globalThis.__validateLazyEffectBenchmark());
	} else {
		await page.evaluate((selectedWorkload) => globalThis.__runLazyEffectBenchmarks(selectedWorkload), workload);
	}

	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}
	const expectedResults = workload === undefined ? 3 : 1;
	if (!smoke && results.length !== expectedResults) {
		throw new Error(`Expected ${expectedResults} benchmark results, received ${results.length}`);
	}

	console.log(
		JSON.stringify({
			browser: await browser.version(),
			build,
			smoke,
			workload: workload ?? "all",
			runs: results.map(({ name }) => name),
		}),
	);
} finally {
	await browser.close();
}
