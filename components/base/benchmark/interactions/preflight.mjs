import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createIsolatedPage, evaluateBench, measureTimerQuantum } from "./browser-helper.mjs";
import { sha256, verifyBuild, writeHashedJSON } from "./integrity.mjs";
import { conditions, protocolRevision, workloads } from "./protocol.mjs";

const arguments_ = parseArguments(process.argv.slice(2));
if (!arguments_.build || !arguments_.output) {
	throw new Error("Usage: node preflight.mjs --build <build-metadata.json> --output <preflight-result.json>");
}

const buildPath = resolve(arguments_.build);
const outputPath = resolve(arguments_.output);
const buildText = await readFile(buildPath, "utf8");
const build = JSON.parse(buildText);
if (build.protocolRevision !== protocolRevision) {
	throw new Error(`Expected build protocol revision ${protocolRevision}; received ${build.protocolRevision}`);
}

const result = {
	buildMetadataSha256: sha256(buildText),
	checks: {},
	closureBefore: await verifyBuild(build),
	conditions: {},
	createdAt: new Date().toISOString(),
	passed: false,
	protocolRevision,
	schemaVersion: 1,
};

try {
	for (const condition of conditions) {
		result.conditions[condition] = {};
		for (const component of ["tabs", "dialog"]) {
			result.conditions[condition][component] = await preflightFixture(condition, component);
		}
	}

	for (const component of ["tabs", "dialog"]) {
		for (const phase of ["initial", "changed", "restored", "afterUpdate", "empty"]) {
			const base = coreSink(result.conditions.base[component].validations[phase]);
			const baseUI = coreSink(result.conditions["base-ui"][component].validations[phase]);
			result.checks[`matched:${component}:${phase}`] = JSON.stringify(base) === JSON.stringify(baseUI);
		}
	}

	result.closureAfter = await verifyBuild(build);
	result.passed = Object.values(result.checks).every(Boolean);
} catch (error) {
	result.error =
		error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : String(error);
	throw error;
} finally {
	result.finishedAt = new Date().toISOString();
	const artifact = await writeHashedJSON(outputPath, result);
	console.log(JSON.stringify({ artifact, checks: result.checks, passed: result.passed }, null, 2));
}

if (!result.passed) {
	process.exitCode = 1;
}

async function preflightFixture(condition, component) {
	const browser = await chromium.launch({ headless: true });
	try {
		const errors = [];
		const bundle = build.outputs[`${condition}-${component}-benchmark`].bundle.path;
		const page = await createIsolatedPage(browser, bundle, errors);
		const identity = await page.evaluate(() => ({
			component: globalThis.__interactionBench?.component,
			condition: globalThis.__interactionBench?.condition,
			crossOriginIsolated,
		}));
		const timerQuantum = await page.evaluate(measureTimerQuantum);
		const count = workloads.find((workload) => workload.component === component)?.count;
		const mount = await evaluateBench(page, "mount", [count]);
		const initial = await evaluateBench(page, "validate");
		let ax;
		let changed;
		let restored;
		if (component === "tabs") {
			await evaluateBench(page, "setState", [1]);
			changed = await evaluateBench(page, "validate");
			ax = await captureAX(page, [
				'[data-bench-tabs="0"] [role="tab"][aria-selected="true"]',
				'[data-bench-tabs="0"] [role="tabpanel"]:not([hidden])',
			]);
			await evaluateBench(page, "setState", [0]);
			restored = await evaluateBench(page, "validate");
		} else {
			await evaluateBench(page, "setState", [true]);
			changed = await evaluateBench(page, "validate");
			ax = await captureAX(page, ['[data-bench-dialog="0"]']);
			await evaluateBench(page, "setState", [false]);
			restored = await evaluateBench(page, "validate");
		}
		const update = await evaluateBench(page, "update", [1]);
		const afterUpdate = await evaluateBench(page, "validate");
		const teardown = await evaluateBench(page, "teardown");
		const empty = await evaluateBench(page, "validateEmpty");
		const checks = {
			accessibleName: Object.values(ax).every((node) => node?.name?.length > 0 && node.ignored === false),
			accessibleRole:
				component === "tabs"
					? Object.values(ax).some((node) => node?.role === "tab") &&
						Object.values(ax).some((node) => node?.role === "tabpanel")
					: Object.values(ax).every((node) => node?.role === "dialog"),
			consoleClean: errors.length === 0,
			crossOriginIsolated: identity.crossOriginIsolated === true,
			finalDOMState:
				changed.firstState === 1 &&
				restored.firstState === 0 &&
				afterUpdate.firstState === (component === "tabs" ? 1 : 0),
			identity: identity.condition === condition && identity.component === component,
			mountCount: mount.sink.itemCount === count && initial.itemCount === count,
			renderOpportunity: [mount, update, teardown].every(
				(observation) => observation.renderOpportunityDurationMs >= observation.durationMs,
			),
			semanticTiming: [mount, update, teardown].every((observation) => observation.durationMs > 0),
			teardown: teardown.sink.itemCount === 0 && empty.itemCount === 0,
			timerQuantum: timerQuantum.sampleCount === 200 && timerQuantum.minMs > 0 && timerQuantum.minMs <= 0.01,
			updateRepetitions: update.repetitions === 1,
		};
		for (const [name, passed] of Object.entries(checks)) {
			result.checks[`${condition}:${component}:${name}`] = passed;
		}
		await page.close();
		return {
			ax,
			browserVersion: await browser.version(),
			checks,
			errors,
			identity,
			observations: { mount, teardown, update },
			timerQuantum,
			validations: { afterUpdate, changed, empty, initial, restored },
		};
	} finally {
		await browser.close();
	}
}

function coreSink(value) {
	return {
		component: value.component,
		firstState: value.firstState,
		focusOwner: value.focusOwner,
		focusRestored: value.focusRestored,
		hiddenPanelCount: value.hiddenPanelCount,
		itemCount: value.itemCount,
		labelledCount: value.labelledCount,
		lastState: value.lastState,
		openCount: value.openCount,
		selectedIndices: value.selectedIndices,
		stableIdentity: value.stableIdentity,
		transitionCount: value.transitionCount,
	};
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
		captured[selector] = node ? { ignored: node.ignored, name: node.name?.value, role: node.role?.value } : null;
	}
	return captured;
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
