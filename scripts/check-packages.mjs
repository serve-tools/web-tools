import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "serve-tools-packages-"));
let failed = false;

try {
	for (const workspace of rootPackage.workspaces) {
		const packageRoot = path.join(root, workspace);
		const packageJSON = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
		const check = packageJSON.scripts?.["check:package"];

		if (check === undefined) {
			continue;
		}

		console.log(`\n> ${packageJSON.name} check:package`);

		try {
			if (check === "npm pack --dry-run --json") {
				await run("npm", ["pack", "--dry-run", "--json"], packageRoot);
				continue;
			}

			if (check !== "publint && attw --pack . --profile esm-only") {
				throw new Error(`Unsupported check:package script: ${check}`);
			}

			const output = await run("npm", ["pack", "--json", "--pack-destination", temporaryRoot], packageRoot, true);
			const packResult = JSON.parse(output);
			const packEntries = Array.isArray(packResult)
				? packResult
				: "filename" in packResult
					? [packResult]
					: Object.values(packResult);
			const [{ filename, files }] = packEntries;
			const tarball = path.join(temporaryRoot, filename);

			if (workspace.startsWith("polyfills/")) {
				validatePolyfillSideEffects(packageJSON, files);
			}

			await run("publint", [tarball, "--pack=false"], root);
			await run("attw", [tarball, "--profile", "esm-only"], root);
		} catch (error) {
			failed = true;
			console.error(error instanceof Error ? error.message : error);
		}
	}
} finally {
	await rm(temporaryRoot, { force: true, recursive: true });
}

if (failed) {
	process.exitCode = 1;
}

function validatePolyfillSideEffects(packageJSON, files) {
	if (!Array.isArray(packageJSON.sideEffects)) {
		throw new Error(`${packageJSON.name}: sideEffects must explicitly list every global installer`);
	}

	const declared = new Set(packageJSON.sideEffects);

	if (declared.size !== packageJSON.sideEffects.length) {
		throw new Error(`${packageJSON.name}: sideEffects must not contain duplicate paths`);
	}

	const expected = new Set();

	for (const [specifier, target] of Object.entries(packageJSON.exports ?? {})) {
		if (specifier === "." || specifier.startsWith("./apply/") || specifier.startsWith("./runtime/")) {
			if (typeof target !== "string") {
				throw new Error(
					`${packageJSON.name}: installer ${specifier} must resolve to one explicit JavaScript file`,
				);
			}

			expected.add(target);
		}
	}

	const packedFiles = new Set(files.map(({ path: file }) => `./${file}`));

	for (const installer of packedFiles) {
		if (!installer.startsWith("./dist/apply/") || !installer.endsWith(".js")) {
			continue;
		}

		if (!expected.has(installer)) {
			throw new Error(
				`${packageJSON.name}: generated installer ${installer} is not publicly exported; run npm run build:fresh`,
			);
		}
	}

	for (const installer of expected) {
		if (!declared.has(installer)) {
			throw new Error(`${packageJSON.name}: sideEffects is missing installer ${installer}`);
		}

		if (!packedFiles.has(installer)) {
			throw new Error(`${packageJSON.name}: declared installer ${installer} is missing from the package`);
		}
	}

	for (const effect of declared) {
		if (!expected.has(effect)) {
			throw new Error(`${packageJSON.name}: sideEffects incorrectly includes ${effect}`);
		}
	}
}

function run(command, arguments_, cwd, capture = false) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, arguments_, {
			cwd,
			shell: process.platform === "win32",
			stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
		});
		let output = "";

		if (capture) {
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk) => {
				output += chunk;
			});
		}

		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolve(output);
				return;
			}

			reject(new Error(`${command} exited with ${signal === null ? `code ${code}` : `signal ${signal}`}`));
		});
	});
}
