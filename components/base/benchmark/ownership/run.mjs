import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const smoke = process.argv[2] === "--smoke";
if ((!smoke && process.argv[2] !== "--confirmed-quiet-slot") || !process.argv[3]) {
	throw new Error("Pass --smoke or, in a quiet measurement window, --confirmed-quiet-slot <build metadata>");
}

const build = JSON.parse(await readFile(process.argv[3], "utf8"));
const bundle = await readFile(build.bundle.path, "utf8");
const browser = await chromium.launch({ headless: true });

try {
	const context = await browser.newContext();
	await context.route("https://base-ownership-benchmark.invalid/", async (route) => {
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
	await page.goto("https://base-ownership-benchmark.invalid/");
	await page.addScriptTag({ content: bundle });
	if (smoke) {
		await page.evaluate(() => globalThis.__validateBaseOwnershipFixture());
	} else {
		await page.evaluate(() => globalThis.__runBaseOwnershipBenchmarks());
	}

	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}
	if (!smoke && results.length !== 4) {
		throw new Error(`Expected 4 benchmark results, received ${results.length}`);
	}

	console.log(
		JSON.stringify({
			browser: await browser.version(),
			build,
			smoke,
			runs: results.map(({ name }) => name),
		}),
	);
} finally {
	await browser.close();
}
