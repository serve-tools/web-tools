import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gradeArtifact, runProcess } from "../grading.mjs";
import { renderReport, summarize } from "../report.mjs";

/** Recheck saved artifacts against explicitly exploratory programs without changing measured costs. */
export async function auditSaved(input, name, transform) {
	const started = performance.now();
	const plan = JSON.parse(await readFile(path.join(input, "plan.json"), "utf8"));
	const original = JSON.parse(await readFile(path.join(input, "report.json"), "utf8"));
	const records = (await readFile(path.join(input, "records.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
	const archive = await readFile(path.join(input, "runtime.tar.gz"));
	assert.equal(createHash("sha256").update(archive).digest("hex"), original.metadata.runtimeArchiveHash);
	const destination = path.join(input, name);
	await mkdir(destination);
	const temporary = await mkdtemp("/private/tmp/serve-tools-transfer-audit-");
	try {
		const extracted = await runProcess("tar", ["-xzf", path.join(input, "runtime.tar.gz"), "-C", temporary]);
		assert.equal(extracted.code, 0, extracted.output);
		const runtime = {
			directory: temporary,
			nodeModules: path.join(temporary, "node_modules"),
			tsc: path.join(temporary, "node_modules/typescript/bin/tsc"),
		};
		const tasks = new Map(plan.tasks.map((task) => [task.id, transform(structuredClone(task))]));
		const checked = [];
		let rechecked = 0;
		for (const record of records) {
			const task = tasks.get(record.taskId);
			if (task === null) {
				checked.push(record);
				continue;
			}
			assert.ok(task, record.taskId);
			const identity = `${record.seed}-${record.run}-${record.taskId}-${record.variant}`;
			const source = await readFile(path.join(input, "attempts", identity, "solution.ts"), "utf8");
			const grade = await gradeArtifact({ root: input, runtime, task, source, hidden: true });
			const artifactPass = grade.compile && grade.contracts !== false && grade.smoke && grade.hidden;
			checked.push({
				...record,
				originalPass: record.pass,
				originalGrade: record.grade,
				grade,
				artifactPass,
				pass: record.status === "completed" && artifactPass,
			});
			++rechecked;
		}
		const metadata = {
			...original.metadata,
			postRunAudit: {
				exploratory: true,
				rechecked,
				elapsedMs: performance.now() - started,
				measuredCostsUnchanged: true,
			},
		};
		const report = summarize(checked, metadata);
		await writeFile(
			path.join(destination, "records.jsonl"),
			`${checked.map((record) => JSON.stringify(record)).join("\n")}\n`,
		);
		await writeFile(path.join(destination, "report.json"), JSON.stringify(report, null, 2));
		await writeFile(path.join(destination, "report.md"), renderReport(report));
		await writeFile(
			path.join(destination, "tasks.json"),
			JSON.stringify([...tasks.values()].filter(Boolean), null, 2),
		);
		return { report, checked };
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
