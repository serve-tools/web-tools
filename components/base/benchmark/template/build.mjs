import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { relative, resolve } from "node:path";
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
const baselineManifestPath = arguments_["baseline-manifest"];
const outputDirectory = arguments_["output-dir"] ?? arguments_.output;

if (!baselineManifestPath || !outputDirectory) {
	throw new Error("Usage: node build.mjs --baseline-manifest <frozen manifest.json> --output-dir <directory>");
}

const output = resolve(outputDirectory);
const conditions = ["baseline", "candidate"];
const aliases = Object.fromEntries(
	[
		["@serve-tools/signal-dom/template", resolve(repository, "client-signals/dom/dist/template.js")],
		["@serve-tools/signal-dom", resolve(repository, "client-signals/dom/dist/signal-dom.js")],
		["@serve-tools/client-dom-fragment", resolve(repository, "client/dom-fragment/dist/client-dom-fragment.js")],
		["@serve-tools/signal-effect", resolve(repository, "signals/effect/dist/signal-effect.js")],
		["@serve-tools/base-components/base", resolve(repository, "components/base/dist/BaseElement.js")],
		["@serve-tools/signal", resolve(repository, "signals/signal/dist/signal.js")],
	].toSorted(([left], [right]) => right.length - left.length),
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

await mkdir(output, { recursive: true });

const baselineManifestText = await readFile(resolve(baselineManifestPath), "utf8");
const baselineManifest = JSON.parse(baselineManifestText);
const frozenBuild = baselineManifest.builds?.current;

if (!frozenBuild?.bundle?.path || !frozenBuild.bundle.sha256) {
	throw new Error("The frozen manifest does not contain builds.current bundle metadata");
}

const frozenCode = await readFile(frozenBuild.bundle.path, "utf8");

if (sha256(frozenCode) !== frozenBuild.bundle.sha256) {
	throw new Error("The frozen current bundle no longer matches its manifest hash");
}

const baselinePath = resolve(output, "baseline.bundle.js");

await writeFile(baselinePath, frozenCode);

const candidateBundle = await rolldown({
	input: resolve(directory, "fixture.ts"),
	plugins: [
		{
			name: "exact-production-aliases",
			resolveId(source) {
				return aliases[source];
			},
		},
	],
	transform: { define: { "process.env.NODE_ENV": '"production"' } },
	treeshake: true,
});

let generated;

try {
	generated = await candidateBundle.generate({ format: "iife", minify: true, sourcemap: false });
} finally {
	await candidateBundle.close();
}

const chunks = generated.output.filter((item) => item.type === "chunk");

if (chunks.length !== 1) {
	throw new Error(`Expected one isolated candidate JavaScript chunk; received ${chunks.length}`);
}

const [chunk] = chunks;
const candidatePath = resolve(output, "candidate.bundle.js");

await writeFile(candidatePath, chunk.code);

const builds = {
	baseline: {
		bundle: await bundleMetadata(frozenCode, baselinePath),
		condition: "baseline",
		frozenInput: {
			bundleSha256: frozenBuild.bundle.sha256,
			condition: "current",
			manifestPath: resolve(baselineManifestPath),
			manifestSha256: sha256(baselineManifestText),
		},
		inputClosure: frozenBuild.inputClosure,
	},
	candidate: {
		bundle: await bundleMetadata(chunk.code, candidatePath),
		condition: "candidate",
		inputClosure: await archiveInputClosure(Object.keys(chunk.modules)),
	},
};

const manifest = {
	builds,
	conditions,
	createdAt: new Date().toISOString(),
	environment: {
		arch: arch(),
		cpu: cpus()[0]?.model,
		logicalCpuCount: cpus().length,
		node: process.version,
		platform: platform(),
		release: release(),
		totalMemoryBytes: totalmem(),
	},
	git: await gitIdentity(),
	protocolRevision: 4,
	rolldown: JSON.parse(await readFile(resolve(repository, "node_modules/rolldown/package.json"), "utf8")).version,
	schemaVersion: 2,
};
const manifestPath = resolve(output, "manifest.json");

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

async function archiveInputClosure(moduleIds) {
	return Promise.all(
		moduleIds.toSorted().map(async (id) => {
			if (id.includes("\0")) {
				return { generated: true, id: id.replaceAll("\0", "\\0") };
			}

			try {
				const source = await readFile(id);

				return {
					bytes: source.byteLength,
					id: relative(repository, id),
					sha256: sha256(source),
				};
			} catch (error) {
				if (error?.code !== "ENOENT") {
					throw error;
				}

				return { id };
			}
		}),
	);
}

async function gitIdentity() {
	const [{ stdout: revision }, { stdout: status }] = await Promise.all([
		runProcess("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }),
		runProcess("git", ["status", "--short"], { cwd: repository, encoding: "utf8" }),
	]);

	return { revision: revision.trim(), status: status.trimEnd().split("\n").filter(Boolean) };
}
