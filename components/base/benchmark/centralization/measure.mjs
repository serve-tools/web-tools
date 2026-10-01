import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { cpus, release } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const [distribution, outputDirectory] = process.argv.slice(2).map((value) => resolve(value));
if (!distribution || !outputDirectory) {
	throw new Error("Pass a package directory and an output directory");
}
await mkdir(outputDirectory, { recursive: true });

const aliases = {};
for (const workspace of JSON.parse(await readFile(`${root}/package.json`)).workspaces) {
	const manifest = JSON.parse(await readFile(`${root}/${workspace}/package.json`));
	for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
		if (typeof target === "string") {
			aliases[`${manifest.name}${subpath === "." ? "" : subpath.slice(1)}`] = resolve(root, workspace, target);
		}
	}
}

const consumers = {
	base: ["BaseElement"],
	checkbox: ["CheckboxElement"],
	switch: ["SwitchElement"],
	field: ["FieldElement"],
	number: ["NumberFieldElement"],
	otp: ["OTPFieldElement"],
	selection: ["SelectElement", "ComboboxElement"],
	"native-fields": ["FieldElement", "NumberFieldElement", "OTPFieldElement"],
	"mixed-controls": ["CheckboxElement", "SwitchElement", "FieldElement", "NumberFieldElement", "OTPFieldElement"],
	"full-library": [],
};
const results = {};
for (const [name, elements] of Object.entries(consumers)) {
	const fixture = elements.length
		? elements
				.map(
					(element, index) =>
						`import { ${element} } from ${JSON.stringify(`${distribution}/dist/${element}.js`)};\ncustomElements.define("measure-${index}", class extends ${element} {});`,
				)
				.join("\n")
		: `export * from ${JSON.stringify(`${distribution}/dist/base.js`)};`;
	const input = `${outputDirectory}/${name}.js`;
	await writeFile(input, fixture);
	const bundle = await rolldown({
		input,
		resolve: { alias: aliases },
		transform: { define: { "process.env.NODE_ENV": '"production"' } },
		treeshake: true,
	});
	const generated = await bundle.generate({ format: "esm", minify: true, sourcemap: false, comments: false });
	await bundle.close();
	const code = generated.output
		.filter((item) => item.type === "chunk")
		.map((item) => item.code)
		.join("");
	await writeFile(`${outputDirectory}/${name}.min.js`, code);
	results[name] = { bytes: Buffer.byteLength(code), sha256: createHash("sha256").update(code).digest("hex") };
}

const sources = (await readdir(`${distribution}/src`, { recursive: true })).filter((name) => name.endsWith(".ts"));
let sourceLines = 0;
for (const name of sources) {
	sourceLines += (await readFile(`${distribution}/src/${name}`, "utf8")).split("\n").length - 1;
}
const report = {
	distribution,
	node: process.version,
	hardware: cpus()[0].model,
	os: { platform: process.platform, release: release() },
	packageLockSha256: createHash("sha256")
		.update(await readFile(`${root}/package-lock.json`))
		.digest("hex"),
	rolldown: JSON.parse(await readFile(`${root}/node_modules/rolldown/package.json`)).version,
	source: { files: sources.length, linesIncludingCommentsAndBlanks: sourceLines },
	consumers: results,
};
await writeFile(`${outputDirectory}/sizes.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
