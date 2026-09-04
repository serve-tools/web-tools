import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CodexProvider } from "../provider.mjs";

const destination = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2], "Supply a new durable output directory.");
await mkdir(destination);
const records = [];
const started = performance.now();
for (const scenario of ["normal", "budget", "timeout"]) {
	const provider = new CodexProvider({
		model: "gpt-5.6-luna",
		effort: "low",
		maxToolCalls: scenario === "budget" ? 1 : 4,
		toolGraceMs: 10_000,
		accountingDrainMs: 100,
	});
	const events = [];
	const calls = [];
	const episodeStarted = performance.now();
	let response;
	try {
		await provider.start();
		response = await provider.run({
			prompt:
				scenario === "budget"
					? "Accounting integration test: call probe with value 1, wait for its result, then call probe with value 2. After the second result, finish immediately with one word. If a tool refuses, finish immediately without further calls."
					: "Accounting integration test: call probe with value 1, wait for its result, then finish immediately with one word.",
			timeoutMs: scenario === "timeout" ? 2_000 : 60_000,
			tools: [
				{
					name: "probe",
					description: "Return the supplied number for an accounting integration test.",
					inputSchema: {
						type: "object",
						properties: { value: { type: "integer" } },
						required: ["value"],
						additionalProperties: false,
					},
				},
			],
			onEvent: (event) => events.push(event),
			onTool: async (name, args) => {
				calls.push({ name, args });
				if (scenario === "timeout") {
					await new Promise((resolve) => setTimeout(resolve, 4_000));
				}
				return { value: args.value };
			},
		});
	} catch (error) {
		response = {
			status: error.status ?? "failed",
			error: error.message,
			usage: error.usage ?? null,
			usageComplete: false,
		};
	} finally {
		await provider.close();
	}
	records.push({ scenario, elapsedMs: performance.now() - episodeStarted, response, events, calls });
	await writeFile(path.join(destination, "records.json"), JSON.stringify(records, null, 2));
	process.stdout.write(
		`${scenario}: ${response.status}, backend ${response.backendStatus}, complete usage ${response.usageComplete}, served calls ${calls.length}\n`,
	);
}
const normal = records[0];
const budget = records[1];
const timeout = records[2];
const checks = {
	normalCompletes: normal.response.status === "completed" && normal.response.usageComplete,
	budgetFailsWithNaturalFinalUsage:
		budget.response.status === "toolLimitExceeded" &&
		budget.response.backendStatus === "completed" &&
		budget.response.usageComplete &&
		budget.calls.length === 1,
	hardCancellationIsNotFalselyComplete:
		["timedOut", "failed"].includes(timeout.response.status) && timeout.response.usageComplete === false,
};
const summary = {
	checks,
	pass: Object.values(checks).every(Boolean),
	elapsedMs: performance.now() - started,
	observedTotalTokens: records.reduce((sum, record) => sum + (record.response.usage?.totalTokens ?? 0), 0),
	usageLimit:
		"The deliberate hard-cancellation scenario remains a lower bound; no final billing acknowledgement exists in this protocol.",
};
await writeFile(path.join(destination, "summary.json"), JSON.stringify(summary, null, 2));
assert.ok(summary.pass, JSON.stringify(summary));
