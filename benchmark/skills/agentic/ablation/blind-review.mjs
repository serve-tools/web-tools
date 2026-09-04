import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { settings } from "./settings.mjs";

/** Select by identity alone; scores and tool histories cannot affect the review sample. */
export function selectReview(jobs, taskIds) {
	return taskIds
		.flatMap((taskId) =>
			settings.variants.map((variant) => {
				const candidates = jobs
					.filter((job) => job.taskId === taskId && job.variant === variant)
					.map((job) => ({ identity: identity(job), rank: hash(`ablation-review-v1:${identity(job)}`) }))
					.sort((left, right) => left.rank.localeCompare(right.rank));
				assert.equal(candidates.length, 2, `${taskId}/${variant}: two planned candidates required`);
				return { taskId, variant, ...candidates[0] };
			}),
		)
		.sort((left, right) => left.rank.localeCompare(right.rank));
}

async function main(input) {
	assert.ok(input, "Supply the completed evidence directory.");
	const directory = path.resolve(input);
	const plan = JSON.parse(await readFile(path.join(directory, "plan.json"), "utf8"));
	const selected = selectReview(
		plan.jobs,
		plan.tasks.map((task) => task.id),
	);
	assert.equal(selected.length, 96);
	const destination = path.join(directory, "blind-review");
	await mkdir(destination);
	const shards = Array.from({ length: 4 }, () => []);
	const manifest = [];
	for (const [index, selectedCase] of selected.entries()) {
		const caseId = `case-${String(index + 1).padStart(3, "0")}`;
		const task = plan.tasks.find((item) => item.id === selectedCase.taskId);
		const source = await readFile(path.join(directory, "attempts", selectedCase.identity, "solution.ts"), "utf8");
		shards[index % 4].push({ caseId, prompt: task.prompt, packages: task.packages, source });
		manifest.push({ caseId, shard: index % 4, ...selectedCase, sourceHash: hash(source) });
	}
	for (const [index, cases] of shards.entries()) {
		await writeFile(path.join(destination, `shard-${index}.json`), JSON.stringify(cases, null, 2));
	}
	await writeFile(path.join(directory, "blind-review-manifest.json"), JSON.stringify(manifest, null, 2));
	process.stdout.write(`Prepared ${selected.length} anonymized cases in ${destination}\n`);
}

function hash(value) {
	return createHash("sha256").update(value).digest("hex");
}
function identity(job) {
	return `${job.seed}-${job.run}-${job.taskId}-${job.variant}`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv[2]).catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
