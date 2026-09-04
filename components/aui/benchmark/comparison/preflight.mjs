import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedPage, evaluateBench, measureTimerQuantum } from "./browser-helper.mjs";
import { makeTargets } from "./src/constants.js";

const arguments_ = parseArguments(process.argv.slice(2));
const buildPath = arguments_.build;
const outputPath = arguments_.output;
if (!buildPath || !outputPath) {
	throw new Error("Usage: node preflight.mjs --build <build-metadata.json> --output <preflight-result.json>");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const buildText = await readFile(resolve(buildPath), "utf8");
const build = JSON.parse(buildText);
if (build.protocolRevision !== 3) {
	throw new Error(`Expected build protocol revision 3; received ${build.protocolRevision}`);
}
const closureBefore = await verifyBuild(build);
const result = {
	buildMetadataSha256: sha256(buildText),
	checks: {},
	closureBefore,
	conditions: {},
	createdAt: new Date().toISOString(),
	protocolRevision: 3,
	schemaVersion: 1,
};

for (const condition of ["aui", "base-ui"]) {
	const browser = await chromium.launch({ headless: true });
	try {
		const errors = [];
		const bundle = build.outputs[`${condition}-benchmark`].bundle.path;
		const page = await createIsolatedPage(browser, bundle, errors);
		const identity = await page.evaluate(() => ({
			condition: globalThis.__checkboxBench?.condition,
			crossOriginIsolated,
			setupMs: globalThis.__checkboxBench?.setupMs,
		}));
		const timerQuantum = await page.evaluate(measureTimerQuantum);

		const mount100 = await evaluateBench(page, "mount", [100]);
		const mount100Validation = await evaluateBench(page, "validate");
		const mount1000 = await evaluateBench(page, "mount", [1000]);
		const mount1000Validation = await evaluateBench(page, "validate");
		const isolated = await groupedPrecisionPreflight(page, (index) =>
			evaluateBench(page, "updateSeries", [1000, index * 1000]),
		);
		const batch100 = await groupedPrecisionPreflight(page, (index) =>
			evaluateBench(page, "updateBatchSeries", [20, 100, index * 20]),
		);
		const batch1000 = await evaluateBench(page, "update", [makeTargets(1000, 1000, 0)]);
		const batch1000Validation = await evaluateBench(page, "validate");
		const ax = await captureAX(page, [
			'[data-bench-control][id="bench-checkbox-0"]',
			'[data-bench-control][id="bench-checkbox-1"]',
			'[data-bench-control][id="bench-checkbox-999"]',
		]);

		const validations = [
			mount100Validation,
			mount1000Validation,
			isolated.afterWarmups,
			isolated.afterOddRecorded,
			isolated.afterRecorded,
			batch100.afterWarmups,
			batch100.afterOddRecorded,
			batch100.afterRecorded,
			batch1000Validation,
		];
		const checks = {
			accessibleNames: Object.values(ax).every((node) => node?.name?.startsWith("Option ")),
			accessibleRoles: Object.values(ax).every((node) => node?.role === "checkbox" && node.ignored === false),
			batch100Precision: groupedPrecisionPassed(batch100, 20, timerQuantum.minMs),
			batch1000Precision: batch1000.durationMs >= 20 * timerQuantum.minMs,
			consoleClean: errors.length === 0,
			crossOriginIsolated: identity.crossOriginIsolated === true,
			identity: identity.condition === condition,
			isolatedPrecision: groupedPrecisionPassed(isolated, 1000, timerQuantum.minMs),
			mount100: mount100.sink.controlCount === 100 && mount100Validation.controlCount === 100,
			mount1000: mount1000.sink.controlCount === 1000 && mount1000Validation.controlCount === 1000,
			semanticCounts: validations.every(
				(validation) =>
					validation.checkedCount === validation.formValues.length &&
					validation.controlCount === validation.labelCount,
			),
			timerQuantum: timerQuantum.sampleCount === 200 && timerQuantum.minMs > 0 && timerQuantum.minMs <= 0.01,
		};
		result.conditions[condition] = {
			ax,
			checks,
			errors,
			identity,
			observations: { batch100, batch1000, isolated, mount100, mount1000 },
			timerQuantum,
			validations: {
				batch100AfterRecorded: batch100.afterRecorded,
				batch100AfterOddRecorded: batch100.afterOddRecorded,
				batch100AfterWarmups: batch100.afterWarmups,
				batch1000Validation,
				isolatedAfterRecorded: isolated.afterRecorded,
				isolatedAfterOddRecorded: isolated.afterOddRecorded,
				isolatedAfterWarmups: isolated.afterWarmups,
				mount1000Validation,
				mount100Validation,
			},
		};
		for (const [name, passed] of Object.entries(checks)) {
			result.checks[`${condition}:${name}`] = passed;
		}
		await page.close();
	} finally {
		await browser.close();
	}
}

const coreSink = ({ checkedCount, controlCount, formValues, labelCount }) => ({
	checkedCount,
	controlCount,
	formValues,
	labelCount,
});
for (const name of [
	"mount100Validation",
	"mount1000Validation",
	"isolatedAfterWarmups",
	"isolatedAfterOddRecorded",
	"isolatedAfterRecorded",
	"batch100AfterWarmups",
	"batch100AfterOddRecorded",
	"batch100AfterRecorded",
	"batch1000Validation",
]) {
	result.checks[`matched:${name}`] =
		JSON.stringify(coreSink(result.conditions.aui.validations[name])) ===
		JSON.stringify(coreSink(result.conditions["base-ui"].validations[name]));
}

for (const name of ["aui-checkbox-app", "base-ui-checkbox-app", "react-native-checkbox-app"]) {
	const browser = await chromium.launch({ headless: true });
	try {
		const errors = [];
		const page = await createIsolatedPage(browser, build.outputs[name].bundle.path, errors);
		await page.waitForFunction(() => document.querySelector("form") !== null);
		await page.waitForFunction(() => new FormData(document.querySelector("form")).get("choice") === "on");
		result.checks[`weight:${name}`] = errors.length === 0;
		await page.close();
	} finally {
		await browser.close();
	}
}

result.checks["weight:fixed-target-recorded"] = build.weights.baseUIIncrementalOverReact.bytes !== undefined;
result.closureAfter = await verifyBuild(build);
result.finishedAt = new Date().toISOString();
result.passed = Object.values(result.checks).every(Boolean);
await writeFile(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ checks: result.checks, output: resolve(outputPath), passed: result.passed }, null, 2));
if (!result.passed) {
	process.exitCode = 1;
}

async function groupedPrecisionPreflight(page, operation) {
	const warmups = [];
	for (let index = 0; index < 8; ++index) {
		warmups.push(await operation(index));
	}
	const afterWarmups = await evaluateBench(page, "validate");
	const recorded = [];
	let afterOddRecorded;
	for (let index = 0; index < 10; ++index) {
		recorded.push(await operation(8 + index));
		if (index === 8) {
			afterOddRecorded = await evaluateBench(page, "validate");
		}
	}
	const afterRecorded = await evaluateBench(page, "validate");
	return { afterOddRecorded, afterRecorded, afterWarmups, recorded, warmups };
}

function groupedPrecisionPassed(group, repetitions, quantum) {
	return (
		group.warmups.length === 8 &&
		group.recorded.length === 10 &&
		[...group.warmups, ...group.recorded].every(
			(observation) => observation.repetitions === repetitions && observation.durationMs >= 20 * quantum,
		)
	);
}

async function captureAX(page, selectors) {
	const cdp = await page.context().newCDPSession(page);
	await Promise.all([cdp.send("Accessibility.enable"), cdp.send("DOM.enable")]);
	const documentNode = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
	const tree = await cdp.send("Accessibility.getFullAXTree");
	const captured = {};
	for (const selector of selectors) {
		const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector });
		if (!nodeId) {
			throw new Error(`AX selector not found: ${selector}`);
		}
		const backendDOMNodeId = (await cdp.send("DOM.describeNode", { nodeId })).node.backendNodeId;
		const node = tree.nodes.find((candidate) => candidate.backendDOMNodeId === backendDOMNodeId);
		captured[selector] = node
			? {
					ignored: node.ignored,
					name: node.name?.value,
					properties: Object.fromEntries(
						(node.properties ?? []).map((property) => [property.name, property.value?.value]),
					),
					role: node.role?.value,
				}
			: null;
	}
	return captured;
}

async function verifyBuild(metadata) {
	const failures = [];
	const entries = new Map();
	for (const output of Object.values(metadata.outputs)) {
		entries.set(output.bundle.path, output.bundle.sha256);
		for (const source of output.inputClosure) {
			entries.set(source.path, source.sha256);
		}
	}
	entries.set(resolve(metadata.closure.path, "package-lock.json"), metadata.closure.packageLockSha256);
	entries.set(resolve(metadata.closure.path, "package.json"), metadata.closure.packageJSONSha256);
	for (const [path, expected] of entries) {
		const actual = sha256(await readFile(path));
		if (actual !== expected) {
			failures.push({ actual, expected, path });
		}
	}
	if (failures.length > 0) {
		throw new Error(`Build closure changed: ${JSON.stringify(failures.slice(0, 5))}`);
	}
	const productionClosureSha256 = sha256(JSON.stringify(metadata.productionClosure.entries));
	if (productionClosureSha256 !== metadata.productionClosure.sha256) {
		throw new Error("Production closure identity is invalid");
	}
	return { fileCount: entries.size, productionClosureSha256 };
}

function parseArguments(values) {
	const parsed = {};
	for (let index = 0; index < values.length; ++index) {
		const argument = values[index];
		if (!argument.startsWith("--") || !values[index + 1] || values[index + 1].startsWith("--")) {
			throw new Error(`Expected a value after ${argument}`);
		}
		parsed[argument.slice(2)] = values[++index];
	}
	return parsed;
}
