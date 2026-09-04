import assert from "node:assert/strict";
import test from "node:test";
import { Program } from "typescript/unstable/async";
import { runCompilerProbe } from "./probe.mjs";

test("installed compiler preserves API/CLI diagnostic parity and reports adapter capability", async () => {
	const report = await runCompilerProbe();
	assert.deepEqual(
		report.checks.filter(({ status }) => status === "failed"),
		[],
	);
	assert.match(report.probeSha256, /^[a-f0-9]{64}$/);
	for (const mode of ["async", "sync"]) {
		for (const name of ["valid", "semantic-error", "syntax-error", "declaration-error", "config-error"]) {
			assert.ok(report.checks.some((check) => check.name === `${mode}/${name}` && check.status === "passed"));
		}
	}
	assert.ok(report.checks.some(({ name, status }) => name === "session-disposal" && status === "passed"));

	if (report.checks.some(({ name, status }) => name === "adapter" && status === "unsupported")) {
		const required = await runCompilerProbe({ "require-adapter": true });
		assert.ok(
			required.checks.some(
				({ status, message }) => status === "failed" && message.includes("required adapter probe"),
			),
		);
	} else {
		assert.ok(
			report.checks.some(({ name, status }) => name === "transitive-edit-with-stale-dist" && status === "passed"),
		);
	}
});

test("a missing created output reports disk, config, project, and emit evidence", async (context) => {
	const emitToString = Program.prototype.emitToString;
	if (typeof emitToString !== "function") {
		context.skip("Compiler does not expose adapter emit capability");
		return;
	}
	let removedOutput = false;
	context.mock.method(Program.prototype, "emitToString", async function (...args) {
		const result = await emitToString.apply(this, args);
		const outputs = [...result.outputFiles];
		if (removedOutput || !outputs.some(([file]) => /[\\/]added\.js$/.test(file))) {
			return result;
		}
		removedOutput = true;
		return {
			...result,
			outputFiles: new Map(outputs.filter(([file]) => !/[\\/]added\.js$/.test(file))),
		};
	});
	const report = await runCompilerProbe();
	const failure = report.checks.find(({ status }) => status === "failed");
	assert.equal(failure?.name, "file-create-delete");
	assert.match(failure.message, /^New included source must emit\n/);
	const detail = JSON.parse(failure.message.slice(failure.message.indexOf("\n") + 1));
	assert.equal(detail.createdFileText, "export const added = 1;");
	assert.equal(detail.createdFileRealpath, detail.createdFile);
	assert.ok(detail.parsedFileNames.some((file) => /[\\/]added\.ts$/.test(file)));
	assert.ok(detail.projectRootNames.some((file) => /[\\/]added\.ts$/.test(file)));
	assert.ok(detail.programSourceFiles.some((file) => /[\\/]added\.ts$/.test(file)));
	assert.ok(detail.emittedOutputs.length > 0);
	assert.equal(detail.emittedOutputs.includes(detail.expectedOutput), false);
	assert.ok(detail.projectOptions.outDir);
	assert.deepEqual(detail.parsedErrors, []);
	assert.equal(detail.invalidation.includesExpectedOutput, true);
	assert.ok(detail.invalidation.emittedOutputs.includes(detail.expectedOutput));
});
