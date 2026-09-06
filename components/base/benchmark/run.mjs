import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { chromium } from "playwright";

if (process.argv[2] !== "--confirmed-quiet-slot") {
	throw new Error("Run only in a quiet measurement window: pass --confirmed-quiet-slot");
}

const outputPath = process.argv[3] ?? "/private/tmp/base-mount-diagnostic.json";
const build = JSON.parse(await readFile("/private/tmp/base-mount-diagnostic.build.json", "utf8"));
const bundle = await readFile(build.outputPath, "utf8");
const pairs = [];
let browserVersion;

const percentile = (values, proportion) => {
	const sorted = values.toSorted((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)];
};

const runCondition = async (condition) => {
	const browser = await chromium.launch({ headless: true });
	try {
		browserVersion ??= await browser.version();
		const context = await browser.newContext();
		await context.route("https://base-benchmark.invalid/", async (route) => {
			await route.fulfill({
				body: "<!doctype html><html><body></body></html>",
				contentType: "text/html",
				status: 200,
			});
		});
		const page = await context.newPage();
		const errors = [];
		page.on("console", (message) => {
			if (message.type() === "error") {
				errors.push(`console: ${message.text()}`);
			}
		});
		page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
		await page.goto("https://base-benchmark.invalid/");
		await page.addScriptTag({ content: bundle });

		const result = await page.evaluate(
			async ({ condition }) => {
				const benchmark = globalThis.__baseMountDiagnostic;
				const warmups = [];
				const observations = [];
				const validations = [];

				for (let index = 0; index < 2; ++index) {
					warmups.push(await benchmark.mount(1_000));
					if (condition === "validate-each" || index === 1) {
						validations.push(benchmark.validate());
					}
				}

				for (let index = 0; index < 12; ++index) {
					observations.push(await benchmark.mount(1_000));
					if (condition === "validate-each" || index === 11) {
						validations.push(benchmark.validate());
					}
				}

				return { condition, observations, validations, warmups };
			},
			{ condition },
		);

		const mountDurations = result.observations.map(({ mountMs }) => mountMs);
		const teardownDurations = result.observations.map(({ teardownMs }) => teardownMs);
		result.summary = {
			mountMedianMs: percentile(mountDurations, 0.5),
			mountP95Ms: percentile(mountDurations, 0.95),
			teardownMedianMs: percentile(teardownDurations, 0.5),
			teardownP95Ms: percentile(teardownDurations, 0.95),
		};
		const expectedSink = {
			checkedCount: 334,
			controlCount: 1_000,
			formValueCount: 334,
			labelCount: 1_000,
			lightDOMElementCount: 3_000,
			shadowElementCount: 3_000,
			shadowRootCount: 1_000,
		};
		for (const validation of result.validations) {
			if (JSON.stringify(validation.sink) !== JSON.stringify(expectedSink)) {
				throw new Error(`Unexpected ${condition} validation sink`);
			}
		}
		if (errors.length > 0) {
			throw new Error(errors.join("\n"));
		}
		return result;
	} finally {
		await browser.close();
	}
};

for (let pairIndex = 0; pairIndex < 5; ++pairIndex) {
	const order = pairIndex % 2 === 0 ? ["validate-each", "validate-final"] : ["validate-final", "validate-each"];
	const results = {};
	for (const condition of order) {
		results[condition] = await runCondition(condition);
	}
	const validateEachSink = results["validate-each"].validations.at(-1).sink;
	const validateFinalSink = results["validate-final"].validations.at(-1).sink;
	if (JSON.stringify(validateEachSink) !== JSON.stringify(validateFinalSink)) {
		throw new Error(`Pair ${pairIndex} final sinks differ`);
	}
	pairs.push({ order, pairIndex, results });
}

const status = execFileSync("git", ["status", "--short", "--", "components/base"], { encoding: "utf8" });
const result = {
	build,
	createdAt: new Date().toISOString(),
	environment: {
		arch: arch(),
		browser: { name: "chromium", version: browserVersion },
		cpus: cpus().length,
		node: process.version,
		platform: platform(),
		release: release(),
		totalMemoryBytes: totalmem(),
	},
	git: {
		revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
		status: status.trimEnd().split("\n").filter(Boolean),
	},
	pairs,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(outputPath);
