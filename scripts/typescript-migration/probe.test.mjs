import assert from "node:assert/strict";
import test from "node:test";
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
