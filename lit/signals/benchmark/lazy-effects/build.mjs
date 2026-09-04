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
const root = options.root && resolve(options.root);
const output = options.output && resolve(options.output);

if (!label || !root || !output) {
	throw new Error("Usage: node build.mjs --label <label> --root <lit-signals root> --output <output prefix>");
}

const dist = resolve(root, "dist");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const signalPath = resolve(root, "../../signals/signal/dist/signal.js");
const watcherPath = resolve(dist, "mixins/SignalWatcher.js");
const entryPath = resolve(dist, "lit-signals.js");
const signal = await readFile(signalPath);
const watcher = await readFile(watcherPath);
const entry = await readFile(entryPath);
const bundle = await rolldown({
	input: `${directory}/fixture.js`,
	resolve: {
		alias: {
			"@serve-tools/lit-signals": entryPath,
			"@serve-tools/signal": signalPath,
		},
	},
	transform: { define: { "process.env.NODE_ENV": '"production"' } },
	treeshake: true,
});
const generated = await bundle.generate({ format: "iife", minify: true, sourcemap: false });
await bundle.close();

const chunk = generated.output.find((item) => item.type === "chunk");
if (!chunk) {
	throw new Error("Lazy effect benchmark emitted no JavaScript chunk");
}

const bundlePath = `${output}.bundle.js`;
const metadataPath = `${output}.build.json`;
const metadata = {
	bundle: { bytes: Buffer.byteLength(chunk.code), path: bundlePath, sha256: sha256(chunk.code) },
	fixtureSha256: sha256(await readFile(`${directory}/fixture.js`)),
	label,
	rolldown: JSON.parse(await readFile(new URL("../../../../node_modules/rolldown/package.json", import.meta.url)))
		.version,
	root,
	subject: {
		entry: { bytes: entry.length, path: entryPath, sha256: sha256(entry) },
		signal: { bytes: signal.length, path: signalPath, sha256: sha256(signal) },
		watcher: { bytes: watcher.length, path: watcherPath, sha256: sha256(watcher) },
	},
};

await writeFile(bundlePath, chunk.code);
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(metadataPath);
