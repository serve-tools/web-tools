import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditSaved } from "../transfer/saved-audit.mjs";
import { analyze } from "./analyze.mjs";
import { renderReport } from "./report.mjs";

const fairnessTasks = new Set([
	"protocol-framed-audit",
	"observable-cold-receipts",
	"observable-event-cancellation",
	"fixed-ping-client",
]);

/** Correct only independently adjudicated requirements; original frozen programs remain untouched. */
export function postrunTask(task, quality = false) {
	if (!fairnessTasks.has(task.id) && !(quality && Object.hasOwn(qualityProbes, task.id))) {
		return null;
	}
	let program = task.programs.hidden;
	if (task.id === "protocol-framed-audit") {
		program = replace(
			program,
			"decodeAuditChunks([new DataView(new ArrayBuffer(4))]), TypeError",
			"decodeAuditChunks([new DataView(new ArrayBuffer(4))])",
		);
		program = replace(program, "decodeAuditChunks(new Array(1)), TypeError", "decodeAuditChunks(new Array(1))");
	}
	if (task.id === "observable-cold-receipts") {
		for (const call of ["collectReceipts(null, () => {})", "collectReceipts(() => 1, null)"]) {
			program = replace(
				program,
				`await assert.rejects(\n\t\t${call},\n\t\tTypeError,\n\t);`,
				`await assert.rejects(Promise.resolve().then(() => ${call}));`,
			);
		}
	}
	if (task.id === "observable-event-cancellation") {
		program = replace(program, "assert.equal(subscriptions, 2);", "assert.ok(subscriptions >= 2);");
		program = replace(
			program,
			"assert.equal(subscriptions, 3);",
			"assert.ok(subscriptions >= 2); inactive.stop(); inactive.stop(); target.dispatchEvent(new CustomEvent('note', { detail: 'still inactive' })); assert.deepEqual(inactive.seen, []);",
		);
		program = replace(
			program,
			"watchUntilAborted({}, new AbortController().signal), TypeError",
			"watchUntilAborted({}, new AbortController().signal)",
		);
		program = replace(program, "watchUntilAborted(target, {}), TypeError", "watchUntilAborted(target, {})");
	}
	if (task.id === "fixed-ping-client") {
		program = replace(program, "for (const init of [null, 1, []])", "for (const init of [null, 1])");
		program += `\n{ const { createPingClient } = await loadSolution(); const client = createPingClient(async () => Response.json({ready:true}), 'https://example.test/base/'); assert.deepEqual(await client.ping([]), {ready:true, requestURL:'https://example.test/ping'}); }\n`;
	}
	if (quality && qualityProbes[task.id]) {
		program += `\n{\n${qualityProbes[task.id]}\n}\n`;
	}
	return { ...task, programs: { ...task.programs, hidden: program } };
}

const qualityProbes = {
	"etag-status-handler": `
const { createStatusHandler } = await loadSolution();
const handle = createStatusHandler();
for (const method of ['GET', 'PUT']) {
 const response = await handle(new Request('https://example.test/statuses/other', method === 'GET' ? {method} : {method, headers:{'content-type':'application/json'}, body:JSON.stringify({status:'up',revision:1})}));
 assert.equal(response.status, 400, 'out-of-enum service must use the canonical invalid-route response');
 assert.deepEqual(await response.json(), {error:'invalid_request'});
}
`,
	"protocol-framed-audit": `
const { decodeAuditChunks } = await loadSolution();
const framed = encodeFrame(serialize({value:1}));
for (const invalid of [{length:0}, new Set(), [new Uint16Array(0)], [framed.buffer.slice(framed.byteOffset, framed.byteOffset+framed.byteLength)], [new DataView(framed.buffer, framed.byteOffset, framed.byteLength)]]) {
 assert.throws(() => decodeAuditChunks(invalid), 'reject invalid chunk containers/types even when their bytes form a valid frame');
}
`,
	"request-target-inspector": `
const { inspectRequestTarget } = await loadSolution();
assert.deepEqual(inspectRequestTarget('/releases/stable?label=%E2%82%AC'), {channel:'stable',page:undefined,labels:['€']});
for (const encoded of ['%FF', '%C0%AF', '%E2%82']) assert.equal(inspectRequestTarget('/releases/stable?label='+encoded), null, 'reject malformed UTF-8 percent encoding');
`,
};

function replace(source, before, after) {
	assert.equal(source.split(before).length, 2, `Expected one frozen assertion: ${before}`);
	return source.replace(before, after);
}

async function main(input) {
	assert.ok(input, "Supply the completed evidence directory.");
	const directory = path.resolve(input);
	const plan = JSON.parse(await readFile(path.join(directory, "plan.json"), "utf8"));
	for (const name of ["fairness", "quality"]) {
		const { report, checked } = await auditSaved(directory, name, (task) => postrunTask(task, name === "quality"));
		const analysis = analyze(checked, { ...plan, metadata: report.metadata });
		analysis.exploratory = true;
		analysis.confirmatoryAdoptionAllowed = false;
		await writeFile(path.join(directory, name, "analysis.json"), JSON.stringify(analysis, null, 2));
		await writeFile(
			path.join(directory, name, "report.md"),
			`# Exploratory ${name} recheck\n\nOriginal measured costs and frozen scores remain preserved. These scores cannot support a new confirmatory claim.\n\n${renderReport(report)}`,
		);
		process.stdout.write(
			`${name}: ${report.conditions.map((row) => `${row.variant} ${row.successes}/${row.attempts}`).join(", ")}\n`,
		);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main(process.argv[2]).catch((error) => {
		process.stderr.write(`${error.stack}\n`);
		process.exitCode = 1;
	});
}
