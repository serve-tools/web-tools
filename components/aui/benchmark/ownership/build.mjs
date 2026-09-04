import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const directory = fileURLToPath(new URL(".", import.meta.url));
const options = Object.fromEntries(
	process.argv
		.slice(2)
		.flatMap((value, index, arguments_) =>
			value.startsWith("--") ? [[value.slice(2), arguments_[index + 1]]] : [],
		),
);
const label = options.label;
const dist = options.dist && resolve(options.dist);
const output = options.output && resolve(options.output);

if (!label || !dist || !output) {
	throw new Error("Usage: node build.mjs --label <label> --dist <AUI dist> --output <output prefix>");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bundle = await rolldown({
	input: `${directory}/fixture.js`,
	resolve: {
		alias: {
			"@serve-tools/aui/field": `${dist}/field-element.js`,
			"@serve-tools/aui/menu": `${dist}/menu-element.js`,
			"@serve-tools/aui/number-field": `${dist}/number-field-element.js`,
			"@serve-tools/aui/toggle": `${dist}/toggle-element.js`,
		},
	},
	transform: { define: { "process.env.NODE_ENV": '"production"' } },
	treeshake: true,
});
const generated = await bundle.generate({ format: "iife", minify: true, sourcemap: false });
await bundle.close();

const chunk = generated.output.find((item) => item.type === "chunk");
if (!chunk) {
	throw new Error("AUI ownership benchmark emitted no JavaScript chunk");
}

const bundlePath = `${output}.bundle.js`;
const metadataPath = `${output}.build.json`;
const metadata = {
	bundle: { bytes: Buffer.byteLength(chunk.code), path: bundlePath, sha256: sha256(chunk.code) },
	dist,
	fixtureSha256: sha256(await readFile(`${directory}/fixture.js`)),
	label,
	rolldown: JSON.parse(await readFile(new URL("../../../../node_modules/rolldown/package.json", import.meta.url)))
		.version,
};

await writeFile(bundlePath, chunk.code);
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(metadataPath);
