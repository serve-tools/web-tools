import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");
const outputPath = "/private/tmp/base-mount-diagnostic.bundle.js";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const bundle = await rolldown({
	input: `${root}/fixture.js`,
	resolve: { alias: { "@serve-tools/base-components/checkbox": `${root}/../dist/CheckboxElement.js` } },
	transform: { define: { "process.env.NODE_ENV": '"production"' } },
	treeshake: true,
});
const generated = await bundle.generate({ format: "iife", minify: true, sourcemap: false });
await bundle.close();

const chunk = generated.output.find((item) => item.type === "chunk");
if (!chunk) {
	throw new Error("Base mount diagnostic emitted no JavaScript chunk");
}

await mkdir("/private/tmp", { recursive: true });
await writeFile(outputPath, chunk.code);

const metadata = {
	bytes: Buffer.byteLength(chunk.code),
	fixtureSha256: sha256(await readFile(`${root}/fixture.js`)),
	outputPath,
	sha256: sha256(chunk.code),
	rolldown: JSON.parse(await readFile(new URL("../../../node_modules/rolldown/package.json", import.meta.url)))
		.version,
};
await writeFile("/private/tmp/base-mount-diagnostic.build.json", `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata, null, 2));
