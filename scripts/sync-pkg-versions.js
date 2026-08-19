// @ts-check
import { glob, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** @type {Map<string, [string, PartialPackage]>} */
const pkgs = new Map();

/** @type {AsyncOperation[]} */
const readOps = [];

/** @type {AsyncOperation[]} */
const writeOpts = [];

for await (const path of glob(["./*/*/package.json"])) {
	readOps.push(async () => {
		// console.log("Reading", path)

		/** @type {PartialPackage} */
		const pkg = JSON.parse(await readFile(resolve(path), "utf8"));

		pkgs.set(pkg.name, [path, pkg]);
	});
}

await Promise.all(readOps.map((op) => op()));

for (const [, [path, pkg]] of pkgs) {
	// console.log("Checking", path)

	/** @type {Map<string, [string, string]>} */
	const shouldUpdatePkgs = new Map();

	for (const depType of /** @type {["dependencies", "devDependencies"]} */ (["dependencies", "devDependencies"])) {
		for (const [dep, version] of Object.entries(pkg[depType] ?? {})) {
			const latestVersion = `^${pkgs.get(dep)?.[1].version ?? ""}`;

			if (latestVersion === "^") {
				continue;
			}

			if (version !== latestVersion) {
				shouldUpdatePkgs.set(dep, [version, latestVersion]);

				pkg[depType][dep] = latestVersion;
			}
		}
	}

	if (shouldUpdatePkgs.size) {
		writeOpts.push(async () => {
			for (const [dep, [version, latestVersion]] of shouldUpdatePkgs) {
				console.log(`Updating ${path}#devDependencies#${dep} from ${version} to ${latestVersion}.`);
			}

			await writeFile(path, `${JSON.stringify(pkg, null, "\t")}\n`);
		});
	}
}

await Promise.all(writeOpts.map((op) => op()));

/** @typedef {{ name: string; version: string; dependencies: Record<string, string>; devDependencies: Record<string, string> }} PartialPackage */
/** @typedef {() => Promise<void>} AsyncOperation */
