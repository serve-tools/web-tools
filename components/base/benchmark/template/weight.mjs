import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { rolldown } from "rolldown";

const runProcess = promisify(execFile);
const scriptRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");
const repoRoot = resolve(scriptRoot, "../../../..");
const defaults = {
	baselineDistribution:
		"/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/baseline/distribution",
	historicalArtifact: "/Users/jonathan/Documents/Codex/outputs/aui-comparison-aggregate-2026-08-28",
	outputDirectory: "/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/weights",
};
const targetBytes = 14_477;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));

const options = parseArguments(process.argv.slice(2));
const historicalArtifact = options.historicalArtifact;
const baselineDistribution = options.baselineDistribution;
const outputDirectory = options.outputDirectory;
const closureRoot = `${historicalArtifact}/closure`;
const bundleDirectory = `${outputDirectory}/bundles`;
const snapshotDirectory = `${outputDirectory}/source-closure`;
const sharedAliases = {
	"@base-ui/react/checkbox": `${closureRoot}/node_modules/@base-ui/react/checkbox/index.mjs`,
	react: `${closureRoot}/node_modules/react/index.js`,
	"react-dom/client": `${closureRoot}/node_modules/react-dom/client.js`,
};

// Frozen inputs retain their original package import, filenames, and custom-element selectors.
const baseAliases = (distribution) => ({
	...sharedAliases,
	"@serve-tools/aui/checkbox":
		distribution === repoRoot
			? `${distribution}/components/base/dist/CheckboxElement.js`
			: `${distribution}/components/aui/dist/checkbox-element.js`,
	"@serve-tools/client-dom-fragment": `${distribution}/client/dom-fragment/dist/client-dom-fragment.js`,
	"@serve-tools/signal": `${distribution}/signals/signal/dist/signal.js`,
	"@serve-tools/signal-dom/template": `${distribution}/client-signals/dom/dist/template.js`,
	"@serve-tools/signal-dom": `${distribution}/client-signals/dom/dist/signal-dom.js`,
	"@serve-tools/signal-effect": `${distribution}/signals/effect/dist/signal-effect.js`,
});

const snapshotName = (id) => {
	if (id.startsWith(`${repoRoot}/`)) {
		return `candidate/${relative(repoRoot, id)}`;
	}

	if (id.startsWith(`${baselineDistribution}/`)) {
		return `baseline/${relative(baselineDistribution, id)}`;
	}

	if (id.startsWith(`${historicalArtifact}/src/`)) {
		return `historical-input/${relative(`${historicalArtifact}/src`, id)}`;
	}

	if (id.startsWith(`${closureRoot}/`)) {
		return `historical-closure/${relative(closureRoot, id)}`;
	}

	return `external/${sha256(id).slice(0, 16)}-${basename(id)}`;
};

const sourceInputs = [
	{
		aliases: baseAliases(baselineDistribution),
		input: "aui-weight.js",
		name: "baseline-base-checkbox-app",
		selector: "weight-aui-checkbox",
	},
	{
		aliases: baseAliases(repoRoot),
		input: "aui-weight.js",
		name: "candidate-base-checkbox-app",
		selector: "weight-aui-checkbox",
	},
	{ aliases: sharedAliases, input: "base-ui-weight.js", name: "base-ui-checkbox-app", selector: "#weight-checkbox" },
	{
		aliases: sharedAliases,
		input: "react-native-weight.js",
		name: "react-native-checkbox-app",
		selector: "#weight-checkbox",
	},
];

await mkdir(bundleDirectory, { recursive: true });
await mkdir(snapshotDirectory, { recursive: true });

const outputs = {};

for (const sourceInput of sourceInputs) {
	const modules = new Map();
	const bundle = await rolldown({
		input: `${historicalArtifact}/src/${sourceInput.input}`,
		plugins: [
			{
				name: `source-closure-${sourceInput.name}`,
				transform(code, id) {
					if (!id.startsWith("\0") && id.startsWith("/")) {
						modules.set(id, code);
					}

					return null;
				},
			},
		],
		resolve: { alias: sourceInput.aliases },
		transform: { define: { "process.env.NODE_ENV": '"production"' } },
		treeshake: true,
	});
	const generated = await bundle.generate({ format: "iife", minify: true, sourcemap: false });

	await bundle.close();

	const chunk = generated.output.find((output) => output.type === "chunk");

	if (!chunk) {
		throw new Error(`No JavaScript chunk emitted for ${sourceInput.name}`);
	}

	if (chunk.code.includes("process.env.NODE_ENV")) {
		throw new Error(`Unreplaced NODE_ENV branch in ${sourceInput.name}`);
	}

	const outputPath = `${bundleDirectory}/${sourceInput.name}.min.js`;

	await writeFile(outputPath, chunk.code);

	const closure = [];

	for (const [id, code] of [...modules].sort(([left], [right]) => left.localeCompare(right))) {
		const snapshotPath = `${snapshotDirectory}/${sourceInput.name}/${snapshotName(id)}`;

		await mkdir(dirname(snapshotPath), { recursive: true });
		await writeFile(snapshotPath, code);
		closure.push({
			bytes: Buffer.byteLength(code),
			originalPath: id,
			sha256: sha256(code),
			snapshotPath: relative(outputDirectory, snapshotPath),
		});
	}

	outputs[sourceInput.name] = {
		brotliBytes: brotliCompressSync(chunk.code, {
			params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
		}).byteLength,
		bytes: Buffer.byteLength(chunk.code),
		closure,
		gzipBytes: gzipSync(chunk.code, { level: constants.Z_BEST_COMPRESSION }).byteLength,
		input: relative(historicalArtifact, `${historicalArtifact}/src/${sourceInput.input}`),
		path: relative(outputDirectory, outputPath),
		sha256: sha256(chunk.code),
	};
}

const values = async (page) => page.evaluate(() => [...new FormData(document.querySelector("form")).entries()]);
const smoke = {};
const browser = await chromium.launch({ headless: true });

try {
	for (const sourceInput of sourceInputs) {
		const page = await browser.newPage();

		await page.setContent("<!doctype html><meta charset=utf-8><title>weight smoke</title>");
		await page.addScriptTag({ path: resolve(outputDirectory, outputs[sourceInput.name].path) });
		await page.locator(sourceInput.selector).waitFor({ state: "attached" });
		await page.waitForFunction(() => new FormData(document.querySelector("form")).get("choice") === "on");

		const initial = await values(page);

		if (JSON.stringify(initial) !== JSON.stringify([["choice", "on"]])) {
			throw new Error(`${sourceInput.name} initial FormData was ${JSON.stringify(initial)}`);
		}

		await page.evaluate((selector) => document.querySelector(selector)?.click(), sourceInput.selector);
		await page.waitForFunction(() => new FormData(document.querySelector("form")).get("choice") === null);
		await page.evaluate((selector) => document.querySelector(selector)?.click(), sourceInput.selector);
		await page.waitForFunction(() => new FormData(document.querySelector("form")).get("choice") === "on");

		const disabledResult = await page.evaluate((selector) => {
			const control = document.querySelector(selector);

			if (!control) {
				throw new Error(`Missing ${selector}`);
			}

			control.disabled = true;
			control.click();

			return {
				checked:
					control.checked === true ||
					control.getAttribute("aria-checked") === "true" ||
					control.getAttribute("data-state") === "checked",
				disabled: control.disabled,
			};
		}, sourceInput.selector);

		if (!disabledResult.disabled || !disabledResult.checked) {
			throw new Error(`${sourceInput.name} disabled control did not retain checked state`);
		}

		smoke[sourceInput.name] = { disabledToggleBlocked: true, enabledToggleWorked: true, initialFormData: initial };
		await page.close();
	}
} finally {
	await browser.close();
}

const packageLockText = await readFile(`${closureRoot}/package-lock.json`, "utf8");
const packageLock = JSON.parse(packageLockText);
const historicalMetadata = await readJSON(`${historicalArtifact}/build-metadata.json`);
const dependencies = {};

for (const packageName of ["@base-ui/react", "react", "react-dom"]) {
	const packagePath = `${closureRoot}/node_modules/${packageName}/package.json`;
	const packageJSON = await readJSON(packagePath);

	dependencies[packageName] = {
		integrity: packageLock.packages[`node_modules/${packageName}`]?.integrity,
		packageJSONSha256: sha256(await readFile(packagePath)),
		resolved: packageLock.packages[`node_modules/${packageName}`]?.resolved,
		version: packageJSON.version,
	};
}

const weights = {
	baseCandidateChangeFromBaseline: difference(
		outputs["candidate-base-checkbox-app"],
		outputs["baseline-base-checkbox-app"],
	),
	baseUIIncrementalOverReact: difference(outputs["base-ui-checkbox-app"], outputs["react-native-checkbox-app"]),
	rawBaseUIIncrementTarget: {
		candidateBaseBytes: outputs["candidate-base-checkbox-app"].bytes,
		deltaBytes: outputs["candidate-base-checkbox-app"].bytes - targetBytes,
		met: outputs["candidate-base-checkbox-app"].bytes <= targetBytes,
		targetBytes,
	},
};
const [{ stdout: revision }, { stdout: status }] = await Promise.all([
	runProcess("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }),
	runProcess("git", ["status", "--short"], { cwd: repoRoot, encoding: "utf8" }),
]);
const metadata = {
	baselineDistribution,
	buildConfiguration: {
		define: { "process.env.NODE_ENV": "production" },
		format: "iife",
		minify: true,
		rolldown: (await readJSON(`${repoRoot}/node_modules/rolldown/package.json`)).version,
		sourcemap: false,
		treeshake: true,
	},
	createdAt: new Date().toISOString(),
	dependencies,
	historicalArtifact,
	historicalBaseUIIncrementalOverReact: historicalMetadata.weights.baseUIIncrementalOverReact,
	outputs,
	packageLock: { path: `${closureRoot}/package-lock.json`, sha256: sha256(packageLockText) },
	repository: { revision: revision.trim(), status: status.trimEnd().split("\n").filter(Boolean) },
	smoke,
	weights,
};

await writeFile(`${outputDirectory}/build-metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(
	`${outputDirectory}/README.md`,
	`# Reproducible one-checkbox executable weights\n\nThis rebuild uses one preserved Base checkbox input twice: once against the frozen pre-migration distribution at \`${baselineDistribution}\` and once against the current candidate distribution.\nThe same build reconstructs Base UI plus React and native React from the pinned historical closure.\nThe fixed acceptance target is Base UI's historical 14,477-byte raw minified increment over native React.\n\nThe Chromium smoke asserts one checked \`FormData\` value and a working enabled toggle followed by a blocked disabled toggle for every bundle.\nThe Base baseline-to-candidate delta measures the shipped cost of the public template API and migrated Checkbox together; it does not attribute bytes to individual internal functions.\n\nRebuild with:\n\n\`\`\`sh\nnode components/base/benchmark/template/weight.mjs \\\n  --historical-artifact ${historicalArtifact} \\\n  --baseline-distribution ${baselineDistribution} \\\n  --output-directory ${outputDirectory}\n\`\`\`\n`,
);

console.log(
	JSON.stringify(
		{
			outputs: Object.fromEntries(
				Object.entries(outputs).map(([name, output]) => [
					name,
					{
						brotliBytes: output.brotliBytes,
						bytes: output.bytes,
						gzipBytes: output.gzipBytes,
						sha256: output.sha256,
					},
				]),
			),
			smoke,
			weights,
		},
		null,
		2,
	),
);

function difference(left, right) {
	return Object.fromEntries(["bytes", "gzipBytes", "brotliBytes"].map((key) => [key, left[key] - right[key]]));
}

function parseArguments(arguments_) {
	const options = { ...defaults };

	for (let index = 0; index < arguments_.length; ++index) {
		const argument = arguments_[index];
		const value = arguments_.at(++index);

		if (!value) {
			throw new Error(`Expected a value after ${argument}`);
		}

		if (argument === "--historical-artifact") {
			options.historicalArtifact = resolve(value);
		} else if (argument === "--baseline-distribution") {
			options.baselineDistribution = resolve(value);
		} else if (argument === "--output-directory") {
			options.outputDirectory = resolve(value);
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}

	return options;
}
