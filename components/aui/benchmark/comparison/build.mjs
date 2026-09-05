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
const brotliCompressAsync = promisify(brotliCompress);
const directory = fileURLToPath(new URL(".", import.meta.url));
const repository = resolve(directory, "../../../..");
const arguments_ = parseArguments(process.argv.slice(2));
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;

if (!outputDirectory) {
	throw new Error("Usage: node build.mjs --output-dir <comparison artifact directory>");
}

const output = resolve(outputDirectory);
const closure = resolve(output, "closure");
const bundleDirectory = resolve(output, "bundles");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const builds = [
	{ input: "src/aui.js", kind: "harness", name: "aui-benchmark" },
	{ input: "src/base-ui.js", kind: "harness", name: "base-ui-benchmark" },
	{ input: "src/aui-weight.js", kind: "weight", name: "aui-checkbox-app" },
	{ input: "src/base-ui-weight.js", kind: "weight", name: "base-ui-checkbox-app" },
	{ input: "src/react-native-weight.js", kind: "weight", name: "react-native-checkbox-app" },
];
const aliases = Object.fromEntries(
	[
		["@base-ui/react/checkbox", resolve(closure, "node_modules/@base-ui/react/checkbox/index.mjs")],
		["@serve-tools/signal-dom/template", resolve(repository, "client-signals/dom/dist/template.js")],
		["@serve-tools/client-dom-fragment", resolve(repository, "client/dom-fragment/dist/client-dom-fragment.js")],
		["@serve-tools/signal-effect", resolve(repository, "signals/effect/dist/signal-effect.js")],
		["@serve-tools/aui/checkbox", resolve(repository, "components/aui/dist/checkbox-element.js")],
		["@serve-tools/signal-dom", resolve(repository, "client-signals/dom/dist/signal-dom.js")],
		["@serve-tools/signal", resolve(repository, "signals/signal/dist/signal.js")],
		["react-dom/client", resolve(closure, "node_modules/react-dom/client.js")],
		["react", resolve(closure, "node_modules/react/index.js")],
	].toSorted(([left], [right]) => right.length - left.length),
);

await mkdir(bundleDirectory, { recursive: true });

const closureLockText = await readFile(resolve(closure, "package-lock.json"), "utf8");
const closurePackageText = await readFile(resolve(closure, "package.json"), "utf8");
const outputs = {};

for (const build of builds) {
	const modules = new Map();
	const bundle = await rolldown({
		input: resolve(directory, build.input),
		plugins: [
			{
				name: "exact-production-aliases",
				resolveId(source) {
					return aliases[source];
				},
			},
			{
				name: `input-closure-${build.name}`,
				transform(code, id) {
					if (!id.includes("\0") && id.startsWith("/")) {
						modules.set(id, code);
					}
					return null;
				},
			},
		],
		transform: { define: { "process.env.NODE_ENV": '"production"' } },
		treeshake: true,
	});

	let generated;
	try {
		generated = await bundle.generate({ format: "iife", minify: true, sourcemap: false });
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
	outputs[build.name] = {
		build,
		bundle: await bundleMetadata(chunk.code, path),
		inputClosure: [...modules]
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([id, code]) => ({ bytes: Buffer.byteLength(code), path: id, sha256: sha256(code) })),
	};
}

const closureEntries = new Map();
for (const outputMetadata of Object.values(outputs)) {
	for (const entry of outputMetadata.inputClosure) {
		closureEntries.set(entry.path, entry.sha256);
	}
}
const productionClosure = {
	entries: [...closureEntries]
		.toSorted(([left], [right]) => left.localeCompare(right))
		.map(([path, hash]) => ({ path, sha256: hash })),
};
productionClosure.sha256 = sha256(JSON.stringify(productionClosure.entries));

const dependencies = {};
for (const packageName of ["@base-ui/react", "react", "react-dom"]) {
	const packagePath = resolve(closure, "node_modules", packageName, "package.json");
	const packageText = await readFile(packagePath, "utf8");
	const packageJSON = JSON.parse(packageText);
	const packageLock = JSON.parse(closureLockText);
	const locked = packageLock.packages[`node_modules/${packageName}`];
	dependencies[packageName] = {
		integrity: locked?.integrity,
		packageJSONSha256: sha256(packageText),
		resolved: locked?.resolved,
		version: packageJSON.version,
	};
}

const weights = { baseUIIncrementalOverReact: {} };
for (const key of ["bytes", "gzipBytes", "brotliBytes"]) {
	weights.baseUIIncrementalOverReact[key] =
		outputs["base-ui-checkbox-app"].bundle[key] - outputs["react-native-checkbox-app"].bundle[key];
}

const [{ stdout: revision }, { stdout: status }] = await Promise.all([
	runProcess("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["status", "--short"], { cwd: repository, encoding: "utf8" }),
]);
const manifest = {
	buildConfiguration: {
		define: { "process.env.NODE_ENV": "production" },
		format: "iife",
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
	git: { revision: revision.trim(), status: status.trimEnd().split("\n").filter(Boolean) },
	outputs,
	productionClosure,
	protocolRevision: 3,
	schemaVersion: 1,
	weights,
};
const manifestPath = resolve(output, "build-metadata.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(manifestPath);

async function bundleMetadata(code, path) {
	const [gzipCode, brotliCode] = await Promise.all([
		gzipAsync(code, { level: constants.Z_BEST_COMPRESSION }),
		brotliCompressAsync(code, {
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
