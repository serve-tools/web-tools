import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const verifyBuild = async (metadata) => {
	const failures = [];
	const entries = new Map();
	for (const output of Object.values(metadata.outputs)) {
		entries.set(output.bundle.path, output.bundle.sha256);
		for (const source of output.inputClosure) {
			entries.set(source.path, source.sha256);
		}
	}
	for (const control of metadata.controlClosure.entries) {
		entries.set(control.path, control.sha256);
	}
	entries.set(resolve(metadata.closure.path, "package-lock.json"), metadata.closure.packageLockSha256);
	entries.set(resolve(metadata.closure.path, "package.json"), metadata.closure.packageJSONSha256);
	for (const [path, expected] of entries) {
		const actual = sha256(await readFile(path));
		if (actual !== expected) {
			failures.push({ actual, expected, path });
		}
	}
	if (failures.length > 0) {
		throw new Error(`Build closure changed: ${JSON.stringify(failures.slice(0, 5))}`);
	}
	const productionClosureSha256 = sha256(JSON.stringify(metadata.productionClosure.entries));
	if (productionClosureSha256 !== metadata.productionClosure.sha256) {
		throw new Error("Production closure identity is invalid");
	}
	const controlClosureSha256 = sha256(JSON.stringify(metadata.controlClosure.entries));
	if (controlClosureSha256 !== metadata.controlClosure.sha256) {
		throw new Error("Benchmark control closure identity is invalid");
	}
	return { controlClosureSha256, fileCount: entries.size, productionClosureSha256 };
};

export const writeHashedJSON = async (path, value) => {
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
	const hash = sha256(await readFile(path));
	await writeFile(`${path}.sha256`, `${hash}  ${path}\n`);
	return { path, sha256: hash };
};
