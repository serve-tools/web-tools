import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createBrowserFixture } from "./browser-fixture.mjs";
import { watchCompilerProject } from "./watcher.mjs";

async function until(predicate, message) {
	const end = Date.now() + 15_000;
	while (Date.now() < end) {
		if (predicate()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	assert.fail(message);
}

test("native watcher reconciles writes, atomic saves, create/delete/recreate, errors, and shutdown", {
	timeout: 60_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const updates = [];
	const errors = [];
	const handlesBefore = ownedHandles();
	let duringUpdate;
	let watcher;
	try {
		watcher = await watchCompilerProject({
			configFile: fixture.configFile,
			cwd: fixture.root,
			onUpdate: async (value) => {
				updates.push(value);
				await duringUpdate?.(value);
			},
			onError: (error) => errors.push(error),
		});
		const output = path.join(fixture.root, "c/dist/index.js");
		const importerSource = path.join(fixture.root, "b/src/value.ts");
		const importerOutput = path.join(fixture.root, "b/dist/value.js");
		const containsFactor = (factor) =>
			new RegExp(`factor\\s*=\\s*${factor}\\b`).test(updates.at(-1)?.outputs.get(output)?.text ?? "");
		assert.ok(containsFactor(3));
		assert.deepEqual(errors, []);
		await fixture.writeDependency(7);
		await until(() => containsFactor(7), "changed dependency did not update");

		const dependencyText = await readFile(fixture.dependency, "utf8");
		const atomicDependency = `${fixture.dependency}.tmp`;
		await writeFile(
			atomicDependency,
			dependencyText.replace("Value = 7", "Value = 8").replace("number = 7", "number = 8"),
		);
		await rename(atomicDependency, fixture.dependency);
		await until(() => containsFactor(8), "atomic replacement of an existing source did not update");

		const source = path.join(fixture.root, "c/src/nested/added.ts");
		const emitted = path.join(fixture.root, "c/dist/nested/added.js");
		await mkdir(path.dirname(source), { recursive: true });
		await writeFile(`${source}.tmp`, "export const added = 1;\n");
		await rename(`${source}.tmp`, source);
		await until(() => updates.at(-1)?.outputs.has(emitted), "atomic nested source did not emit");
		await rm(source);
		await until(() => !updates.at(-1)?.outputs.has(emitted), "deleted output survived");
		await writeFile(source, "export const added = 2;\n");
		await until(
			() => updates.at(-1)?.outputs.get(emitted)?.text.includes("added = 2"),
			"recreated source did not emit",
		);

		const updatesBeforeError = updates.length;
		await fixture.writeCompilerError();
		await until(() => errors.length > 0, "compiler error was not reported");
		assert.match(errors.at(-1).message, /2322|not assignable/);
		assert.equal(updates.length, updatesBeforeError, "failed generation was published");
		await fixture.writeDependency(9);
		await until(() => containsFactor(9), "compiler did not recover");

		const importerText = await readFile(importerSource, "utf8");
		await Promise.all([
			fixture.writeDependency(11),
			writeFile(importerSource, importerText.replace("factor * Factor.Value", "factor * Factor.Value + 5")),
		]);
		await until(
			() =>
				containsFactor(11) &&
				/factor \* 11 \/\* Factor\.Value \*\/ \+ 5/.test(
					updates.at(-1)?.outputs.get(importerOutput)?.text ?? "",
				),
			"concurrent importer and dependency state was lost",
		);

		let injected = false;
		duringUpdate = async (generation) => {
			if (!injected && /factor\s*=\s*13\b/.test(generation.outputs.get(output)?.text ?? "")) {
				injected = true;
				await fixture.writeDependency(17);
			}
		};
		await fixture.writeDependency(13);
		await until(() => containsFactor(17), "edit arriving during an active update was lost");
		assert.equal(injected, true);
		duringUpdate = undefined;

		await fixture.writeDependency(19);
		await fixture.writeDependency(21);
		await until(() => containsFactor(21), "rapid edits did not settle on the final state");

		const firstClose = watcher.close();
		const concurrentClose = watcher.close();
		assert.equal(concurrentClose, firstClose);
		await firstClose;
		assert.equal(watcher.closed, true);
		assert.equal(watcher.close(), firstClose);
		await until(() => ownedHandles() <= handlesBefore, "native watcher or compiler child survived disposal");
	} finally {
		await watcher?.close();
		await fixture.dispose();
	}
});

test("native watcher follows file and directory replacements through subsequent writes", {
	timeout: 30_000,
}, async () => {
	const fixture = await createBrowserFixture();
	const output = path.join(fixture.root, "c/dist/index.js");
	let generation;
	let watcher;
	try {
		watcher = await watchCompilerProject({
			configFile: fixture.configFile,
			cwd: fixture.root,
			onUpdate(value) {
				generation = value;
			},
		});
		const containsFactor = (factor) =>
			new RegExp(`factor\\s*=\\s*${factor}\\b`).test(generation.outputs.get(output)?.text ?? "");
		const original = await readFile(fixture.dependency, "utf8");
		const replacement = `${fixture.dependency}.tmp`;
		await writeFile(replacement, original.replaceAll("= 3", "= 7"));
		await rename(replacement, fixture.dependency);
		await until(() => containsFactor(7), "atomic replacement did not update");
		await fixture.writeDependency(9);
		await until(() => containsFactor(9), "write after atomic replacement was lost");

		const sourceDirectory = path.dirname(fixture.dependency);
		await rename(sourceDirectory, path.join(fixture.root, "previous-src"));
		await mkdir(sourceDirectory);
		await fixture.writeDependency(11);
		await until(() => containsFactor(11), "replacement source directory did not update");
		await fixture.writeDependency(13);
		await until(() => containsFactor(13), "write in replacement source directory was lost");
	} finally {
		await watcher?.close();
		await fixture.dispose();
	}
});

test("callback failures are reported without an unhandled pump rejection", { timeout: 30_000 }, async () => {
	const fixture = await createBrowserFixture();
	const reported = [];
	const updateFailure = new Error("update callback failed");
	const errorFailure = new Error("error callback failed");
	let rejectUpdate = false;
	let rejectError = false;
	let watcher;
	try {
		watcher = await watchCompilerProject({
			configFile: fixture.configFile,
			cwd: fixture.root,
			onUpdate() {
				if (rejectUpdate) {
					throw updateFailure;
				}
			},
			onError(error) {
				reported.push(error);
				if (rejectError) {
					throw errorFailure;
				}
			},
		});

		rejectUpdate = true;
		await fixture.writeDependency(7);
		await until(
			() => reported.includes(updateFailure) && watcher.error === updateFailure,
			"rejected update callback was not reported",
		);

		rejectUpdate = false;
		rejectError = true;
		await fixture.writeCompilerError();
		await until(() => watcher.error === errorFailure, "rejected error callback was not retained");
	} finally {
		await watcher?.close();
		await fixture.dispose();
	}
});

test("close awaited from an update callback disposes without deadlock", { timeout: 30_000 }, async () => {
	const fixture = await createBrowserFixture();
	const handlesBefore = ownedHandles();
	let updates = 0;
	let closeFromCallback;
	let watcher;
	try {
		watcher = await watchCompilerProject({
			configFile: fixture.configFile,
			cwd: fixture.root,
			async onUpdate() {
				if (++updates === 2) {
					closeFromCallback = watcher.close();
					await closeFromCallback;
				}
			},
		});

		await fixture.writeDependency(7);
		await until(() => watcher.closed && closeFromCallback, "update callback did not close the watcher");
		await closeFromCallback;
		assert.equal(watcher.close(), closeFromCallback);
		assert.equal(watcher.error, undefined);
		await until(() => ownedHandles() <= handlesBefore, "callback close left native resources active");
	} finally {
		await watcher?.close();
		await fixture.dispose();
	}
});

function ownedHandles() {
	return process
		._getActiveHandles()
		.filter(({ constructor }) => constructor?.name === "ChildProcess" || constructor?.name === "FSWatcher").length;
}
