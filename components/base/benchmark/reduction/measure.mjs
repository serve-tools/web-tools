import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
if (process.argv.length !== 4) {
	throw new Error("Pass the package directory and output directory");
}
const distribution = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(`${distribution}/package.json`, "utf8"));
const aliases = {};
for (const workspace of JSON.parse(await readFile(`${root}/package.json`, "utf8")).workspaces) {
	const metadata = JSON.parse(await readFile(`${root}/${workspace}/package.json`, "utf8"));
	for (const [subpath, target] of Object.entries(metadata.exports ?? {})) {
		if (typeof target === "string") {
			aliases[`${metadata.name}${subpath === "." ? "" : subpath.slice(1)}`] = resolve(root, workspace, target);
		}
	}
}
const foundations = new Map([
	[resolve(distribution, "dist/BaseElement.js"), "@foundation/base"],
	[resolve(distribution, "dist/template.js"), "@foundation/template"],
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const entries = {};
for (const [subpath, target] of Object.entries({ ...manifest.exports, "./all-public": null })) {
	const name = subpath === "." ? "full-library" : subpath.slice(2);
	const fixture = resolve(output, `${name}.entry.js`);
	const code = target
		? `export * from ${JSON.stringify(resolve(distribution, target))};\n`
		: Object.values(manifest.exports)
				.map((path, index) => `export * as entry${index} from ${JSON.stringify(resolve(distribution, path))};`)
				.join("\n");
	await writeFile(fixture, code);
	entries[name] = {};
	for (const externalized of [false, true]) {
		const mode = externalized ? "component" : "standalone";
		const build = await rolldown({
			tsconfig: false,
			input: fixture,
			resolve: { alias: aliases },
			external: externalized ? (id) => foundations.has(id) || id.startsWith("@serve-tools/signal") : undefined,
			transform: { define: { "process.env.NODE_ENV": '"production"' } },
			treeshake: true,
		});
		try {
			const generated = await build.generate({
				format: "esm",
				minify: true,
				sourcemap: false,
				comments: false,
				paths: (id) => foundations.get(id) ?? id,
			});
			const code = generated.output
				.filter((item) => item.type === "chunk")
				.map((item) => item.code)
				.join("");
			await writeFile(resolve(output, `${name}.${mode}.min.js`), code);
			entries[name][mode] = { bytes: Buffer.byteLength(code), sha256: hash(code) };
		} finally {
			await build.close();
		}
	}
}

const modules = {};
for (const name of (await readdir(`${distribution}/dist`, { recursive: true }))
	.filter((name) => name.endsWith(".js"))
	.sort()) {
	const build = await rolldown({
		tsconfig: false,
		input: resolve(distribution, "dist", name),
		external: (_id, importer) => importer !== undefined,
		treeshake: false,
	});
	try {
		const generated = await build.generate({ format: "esm", minify: true, sourcemap: false, comments: false });
		const code = generated.output
			.filter((item) => item.type === "chunk")
			.map((item) => item.code)
			.join("");
		modules[name] = { bytes: Buffer.byteLength(code), sha256: hash(code) };
	} finally {
		await build.close();
	}
}
const source = { files: 0, bytes: 0, physicalLinesIncludingCommentsAndBlanks: 0, hashes: {} };
for (const name of (await readdir(`${distribution}/src`, { recursive: true }))
	.filter((name) => name.endsWith(".ts"))
	.sort()) {
	const text = await readFile(resolve(distribution, "src", name), "utf8");
	++source.files;
	source.bytes += Buffer.byteLength(text);
	source.physicalLinesIncludingCommentsAndBlanks += text.split("\n").length - 1;
	source.hashes[name] = hash(text);
}
const result = {
	createdAt: new Date().toISOString(),
	distribution,
	node: process.version,
	rolldown: JSON.parse(await readFile(`${root}/node_modules/rolldown/package.json`, "utf8")).version,
	packageLockSha256: hash(await readFile(`${root}/package-lock.json`)),
	source,
	modules,
	minifiedModuleBytes: Object.values(modules).reduce((total, module) => total + module.bytes, 0),
	entries,
	exports: manifest.exports,
	dependencies: manifest.dependencies,
};
await writeFile(resolve(output, "sizes.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ source, minifiedModuleBytes: result.minifiedModuleBytes, full: entries["full-library"] }));
