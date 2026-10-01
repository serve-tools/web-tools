import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import { rolldown } from "rolldown";
import { protocolRevision } from "./protocol.mjs";

const runProcess = promisify(execFile);
const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const directory = fileURLToPath(new URL(".", import.meta.url));
const repository = resolve(directory, "../../../..");
const arguments_ = parseArguments(process.argv.slice(2));
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;
const closureDirectory = arguments_["closure-dir"];
if (!outputDirectory || !closureDirectory) {
	throw new Error(
		"Usage: node build.mjs --closure-dir <pinned dependency closure> --output-dir <artifact directory>",
	);
}

const output = resolve(outputDirectory);
const closure = resolve(closureDirectory);
const bundleDirectory = resolve(output, "bundles");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const builds = [
	{ component: "tabs", condition: "base", input: "src/base-tabs.js" },
	{ component: "tabs", condition: "base-ui", input: "src/base-ui-tabs.js" },
	{ component: "dialog", condition: "base", input: "src/base-dialog.js" },
	{ component: "dialog", condition: "base-ui", input: "src/base-ui-dialog.js" },
].map((build) => ({ ...build, name: `${build.condition}-${build.component}-benchmark` }));
const aliases = new Map([
	["@base-ui/react/dialog", resolve(closure, "node_modules/@base-ui/react/dialog/index.mjs")],
	["@base-ui/react/tabs", resolve(closure, "node_modules/@base-ui/react/tabs/index.mjs")],
	["@serve-tools/base-components/dialog", resolve(repository, "components/base/dist/DialogElement.js")],
	["@serve-tools/base-components/tabs", resolve(repository, "components/base/dist/TabsElement.js")],
	["react-dom/client", resolve(closure, "node_modules/react-dom/client.js")],
	["react", resolve(closure, "node_modules/react/index.js")],
]);

await mkdir(bundleDirectory, { recursive: true });

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
if (
	dependencies["@base-ui/react"].version !== "1.7.0" ||
	dependencies.react.version !== "19.2.8" ||
	dependencies["react-dom"].version !== "19.2.8"
) {
	throw new Error(`Unexpected pinned dependency versions: ${JSON.stringify(dependencies)}`);
}

const outputs = {};
for (const build of builds) {
	outputs[build.name] = await buildBundle(build);
}

const controlClosure = {
	entries: await Promise.all(
		(await readdir(directory, { recursive: true }))
			.filter((path) => path.endsWith(".js") || path.endsWith(".mjs"))
			.toSorted()
			.map(async (path) => {
				const absolutePath = resolve(directory, path);
				return { path: absolutePath, sha256: sha256(await readFile(absolutePath)) };
			}),
	),
};
controlClosure.sha256 = sha256(JSON.stringify(controlClosure.entries));

const sourceEntries = new Map();
for (const metadata of Object.values(outputs)) {
	for (const entry of metadata.inputClosure) {
		sourceEntries.set(entry.path, entry.sha256);
	}
}
const productionClosure = {
	entries: [...sourceEntries]
		.toSorted(([left], [right]) => left.localeCompare(right))
		.map(([path, hash]) => ({ path, sha256: hash })),
};
productionClosure.sha256 = sha256(JSON.stringify(productionClosure.entries));

const [{ stdout: revision }, { stdout: status }, { stdout: diff }] = await Promise.all([
	runProcess("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["status", "--short"], { cwd: repository, encoding: "utf8" }),
	runProcess("git", ["diff", "--binary", "HEAD", "--"], {
		cwd: repository,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	}),
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
	controlClosure,
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
	git: {
		diffSha256: sha256(diff),
		revision: revision.trim(),
		status: status.trimEnd().split("\n").filter(Boolean),
	},
	outputs,
	productionClosure,
	protocolRevision,
	schemaVersion: 1,
};
const manifestPath = resolve(output, "build-metadata.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(`${manifestPath}.sha256`, `${sha256(await readFile(manifestPath))}  ${manifestPath}\n`);
console.log(manifestPath);

async function buildBundle(build) {
	const modules = new Map();
	const bundle = await rolldown({
		input: resolve(directory, build.input),
		plugins: [
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
	return {
		build,
		bundle: await bundleMetadata(chunk.code, path),
		inputClosure: [...modules]
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([path, code]) => ({ bytes: Buffer.byteLength(code), path, sha256: sha256(code) })),
	};
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
