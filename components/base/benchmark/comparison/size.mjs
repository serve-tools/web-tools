import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import { rolldown } from "rolldown";

const runProcess = promisify(execFile);
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const directory = fileURLToPath(new URL(".", import.meta.url));
const repository = resolve(directory, "../../../..");
const arguments_ = parseArguments(process.argv.slice(2));
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;
const closureDirectory = arguments_["closure-dir"];

if (!outputDirectory || !closureDirectory) {
	throw new Error("Usage: node size.mjs --closure-dir <pinned dependency closure> --output-dir <artifact directory>");
}

const output = resolve(outputDirectory);
const closure = resolve(closureDirectory);
const bundleDirectory = resolve(output, "size-bundles");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const componentNames = ["checkbox", "switch", "tabs", "dialog", "combined"];
const baseSource = resolve(directory, "src/size/base.js");
const baseUISource = resolve(directory, "src/size/base-ui.js");
const sources = {
	base: Object.fromEntries(
		componentNames.map((component) => [
			component,
			component === "combined" ? baseSource : resolve(directory, `src/size/base-${component}.js`),
		]),
	),
	"base-ui": Object.fromEntries(
		componentNames.map((component) => [
			component,
			component === "combined" ? baseUISource : resolve(directory, `src/size/base-ui-${component}.js`),
		]),
	),
};
const baseFrameworkSource = resolve(directory, "src/size/base-framework.js");
const reactFrameworkSource = resolve(directory, "src/size/react-framework.js");
const baseElementPath = resolve(repository, "components/base/dist/BaseElement.js");
const templatePath = resolve(repository, "components/base/dist/template.js");
const baseFrameworkDirectories = [
	resolve(repository, "client/dom-fragment/dist"),
	resolve(repository, "client-signals/dom/dist"),
	resolve(repository, "signals/effect/dist"),
	resolve(repository, "signals/signal/dist"),
];
const reactFrameworkDirectories = ["react", "react-dom", "scheduler"].map((name) =>
	resolve(closure, "node_modules", name),
);
const aliases = new Map([
	["@base-ui/react/checkbox", resolve(closure, "node_modules/@base-ui/react/checkbox/index.mjs")],
	["@base-ui/react/dialog", resolve(closure, "node_modules/@base-ui/react/dialog/index.mjs")],
	["@base-ui/react/switch", resolve(closure, "node_modules/@base-ui/react/switch/index.mjs")],
	["@base-ui/react/tabs", resolve(closure, "node_modules/@base-ui/react/tabs/index.mjs")],
	["@serve-tools/base-components/base", baseElementPath],
	["@serve-tools/base-components/checkbox", resolve(repository, "components/base/dist/CheckboxElement.js")],
	["@serve-tools/base-components/dialog", resolve(repository, "components/base/dist/DialogElement.js")],
	["@serve-tools/base-components/switch", resolve(repository, "components/base/dist/SwitchElement.js")],
	["@serve-tools/base-components/tabs", resolve(repository, "components/base/dist/TabsElement.js")],
	["@serve-tools/base-components/template", templatePath],
	["@serve-tools/client-dom-fragment", resolve(repository, "client/dom-fragment/dist/client-dom-fragment.js")],
	["@serve-tools/signal-dom/template", resolve(repository, "client-signals/dom/dist/template.js")],
	["@serve-tools/signal-dom", resolve(repository, "client-signals/dom/dist/signal-dom.js")],
	["@serve-tools/signal-effect", resolve(repository, "signals/effect/dist/signal-effect.js")],
	["@serve-tools/signal", resolve(repository, "signals/signal/dist/signal.js")],
	["react-dom/client", resolve(closure, "node_modules/react-dom/client.js")],
	["react", resolve(closure, "node_modules/react/index.js")],
]);

await mkdir(bundleDirectory, { recursive: true });

const builds = [];
for (const component of componentNames) {
	const exportName = component === "combined" ? "mountCombined" : "mount";
	builds.push(
		{
			external: "base-framework",
			input: virtualInput(`base-${component}-component`, sources.base[component], exportName),
			kind: "component-externalized",
			name: `base-${component}-component`,
			side: "base",
		},
		{
			external: "react-framework",
			input: virtualInput(`base-ui-${component}-component`, sources["base-ui"][component], exportName),
			kind: "component-externalized",
			name: `base-ui-${component}-component`,
			side: "base-ui",
		},
		{
			input: virtualInput(`base-${component}-standalone`, sources.base[component], exportName),
			kind: "standalone",
			name: `base-${component}-standalone`,
			side: "base",
		},
		{
			input: virtualInput(`base-ui-${component}-standalone`, sources["base-ui"][component], exportName),
			kind: "standalone",
			name: `base-ui-${component}-standalone`,
			side: "base-ui",
		},
	);
}
builds.push(
	{ input: fileInput(baseFrameworkSource), kind: "framework-baseline", name: "base-framework", side: "base" },
	{ input: fileInput(reactFrameworkSource), kind: "framework-baseline", name: "react-framework", side: "base-ui" },
);

const outputs = {};
for (const build of builds) {
	outputs[build.name] = await buildBundle(build);
}

const frameworkBaselines = {
	base: outputs["base-framework"].bundle,
	"base-ui": outputs["react-framework"].bundle,
};
const frameworkBaselineDifferentials = {};
for (const side of ["base", "base-ui"]) {
	for (const component of componentNames) {
		const bundle = outputs[`${side}-${component}-standalone`].bundle;
		const baseline = frameworkBaselines[side];
		frameworkBaselineDifferentials[`${side}-${component}`] = difference(bundle, baseline);
	}
}

const closurePackageText = await readFile(resolve(closure, "package.json"), "utf8");
const closureLockText = await readFile(resolve(closure, "package-lock.json"), "utf8");
const lock = JSON.parse(closureLockText);
const dependencies = {};
for (const packageName of ["@base-ui/react", "react", "react-dom", "scheduler"]) {
	const packageText = await readFile(resolve(closure, "node_modules", packageName, "package.json"), "utf8");
	const installed = JSON.parse(packageText);
	const locked = lock.packages[`node_modules/${packageName}`];
	dependencies[packageName] = {
		integrity: locked?.integrity,
		packageJSONSha256: sha256(packageText),
		resolved: locked?.resolved,
		version: installed.version,
	};
}

const [{ stdout: revision }, { stdout: status }, { stdout: diff }] = await Promise.all([
	runProcess("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["status", "--short"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["diff", "--binary", "HEAD", "--"], {
		cwd: repository,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	}),
]);
const sourceEntries = new Map();
for (const metadata of Object.values(outputs)) {
	for (const entry of metadata.inputClosure) {
		sourceEntries.set(entry.path, entry.sha256);
	}
}
const sourceClosure = {
	entries: [...sourceEntries]
		.toSorted(([left], [right]) => left.localeCompare(right))
		.map(([path, hash]) => ({ path, sha256: hash })),
};
sourceClosure.sha256 = sha256(JSON.stringify(sourceClosure.entries));

const manifest = {
	buildConfiguration: {
		format: "esm",
		minify: true,
		rolldown: JSON.parse(await readFile(resolve(repository, "node_modules/rolldown/package.json"), "utf8")).version,
		sourcemap: false,
		treeshake: true,
	},
	closure: {
		packageJSONSha256: sha256(closurePackageText),
		packageLockSha256: sha256(closureLockText),
		path: closure,
	},
	createdAt: new Date().toISOString(),
	dependencies,
	environment: {
		arch: arch(),
		cpu: cpus()[0]?.model,
		logicalCpuCount: cpus().length,
		node: process.version,
		platform: platform(),
		release: release(),
		totalMemoryBytes: totalmem(),
	},
	exclusions: {
		base: {
			description:
				"Generic BaseElement, template, Signal, Signal DOM, Signal Effect, and client DOM fragment runtime; component-specific foundations remain included",
			paths: [baseElementPath, templatePath, ...baseFrameworkDirectories],
		},
		"base-ui": {
			description: "React, React DOM, and scheduler runtime; Base UI implementation utilities remain included",
			paths: reactFrameworkDirectories,
		},
	},
	frameworkBaselineDifferentials,
	git: {
		diffSha256: sha256(diff),
		revision: revision.trim(),
		status: status.trimEnd().split("\n").filter(Boolean),
	},
	outputs,
	schemaVersion: 1,
	sourceClosure,
};
const manifestPath = resolve(output, "size-metadata.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(manifestPath);

async function buildBundle(build) {
	const modules = new Map();
	const bundle = await rolldown({
		external: build.external ? (source, importer) => isExternal(build.external, source, importer) : undefined,
		input: build.input.id,
		plugins: [
			{
				name: "comparison-virtual-input",
				resolveId(source) {
					if (source === build.input.id) {
						return source;
					}
				},
				load(id) {
					if (id === build.input.id) {
						return build.input.code;
					}
				},
			},
			{
				name: "exact-production-aliases",
				resolveId(source) {
					return aliases.get(source);
				},
			},
			{
				name: `input-closure-${build.name}`,
				transform(code, id) {
					if (!id.includes("\0") && id.startsWith("/")) {
						modules.set(id, code);
					}
				},
			},
		],
		transform: { define: { "process.env.NODE_ENV": '"production"' } },
		treeshake: true,
	});

	let generated;
	try {
		generated = await bundle.generate({ format: "esm", minify: true, sourcemap: false });
	} finally {
		await bundle.close();
	}

	const chunks = generated.output.filter((item) => item.type === "chunk");
	if (chunks.length !== 1) {
		throw new Error(`Expected one JavaScript chunk for ${build.name}; received ${chunks.length}`);
	}
	const [chunk] = chunks;
	if (chunk.code.includes("process.env.NODE_ENV")) {
		throw new Error(`Unreplaced NODE_ENV branch in ${build.name}`);
	}
	const path = resolve(bundleDirectory, `${build.name}.min.js`);
	await writeFile(path, chunk.code);
	return {
		build: { ...build, input: build.input.id },
		bundle: await bundleMetadata(chunk.code, path),
		externalImports: chunk.imports,
		inputClosure: [...modules]
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([path, code]) => ({ bytes: Buffer.byteLength(code), path, sha256: sha256(code) })),
	};
}

function isExternal(kind, source, importer) {
	const resolvedSource = source.startsWith("/") ? source : aliases.get(source);
	if (kind === "base-framework") {
		return (
			source === "@serve-tools/base-components/base" ||
			source === "@serve-tools/base-components/template" ||
			source.startsWith("@serve-tools/signal") ||
			source === "@serve-tools/client-dom-fragment" ||
			resolvedSource === baseElementPath ||
			resolvedSource === templatePath ||
			baseFrameworkDirectories.some((path) => resolvedSource?.startsWith(`${path}/`))
		);
	}

	if (/^(?:react|react-dom|scheduler)(?:\/|$)/.test(source)) {
		return true;
	}
	return (
		reactFrameworkDirectories.some((path) => resolvedSource?.startsWith(`${path}/`)) ||
		(importer !== undefined && reactFrameworkDirectories.some((path) => source.startsWith(path)))
	);
}

function virtualInput(name, source, exportName) {
	return {
		code: `import { ${exportName} } from ${JSON.stringify(source)};\n${exportName}();\n`,
		id: `\0${name}`,
	};
}

function fileInput(path) {
	return { code: undefined, id: path };
}

async function bundleMetadata(code, path) {
	const [gzipCode, brotliCode] = await Promise.all([
		gzipAsync(code, { level: constants.Z_BEST_COMPRESSION }),
		brotliAsync(code, {
			params: {
				[constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
				[constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
			},
		}),
	]);
	return {
		brotliBytes: brotliCode.byteLength,
		bytes: Buffer.byteLength(code),
		gzipBytes: gzipCode.byteLength,
		path,
		sha256: sha256(code),
	};
}

function difference(bundle, baseline) {
	return Object.fromEntries(["bytes", "gzipBytes", "brotliBytes"].map((key) => [key, bundle[key] - baseline[key]]));
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
