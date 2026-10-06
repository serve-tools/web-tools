import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/** Execute the authored example rather than a separately maintained copy. */
async function executeExample(path, index = 0) {
	const markdown = await readFile(new URL(path, import.meta.url), "utf8");
	const examples = [...markdown.matchAll(/```js\n([\s\S]*?)\n```/g)].map((match) => match[1]);
	const source = examples[index];

	assert.ok(source, `Missing JavaScript example ${index} in ${path}`);

	const executable = source.replace(
		/import \{ ([^}]+) \} from "([^"]+)";/g,
		(_match, names, module) => `const { ${names} } = await import("${module}");`,
	);
	const logs = [];
	await new AsyncFunction("console", executable)({ log: (...values) => logs.push(values) });

	return logs;
}

test("Signal README derives and refreshes totals", async () => {
	assert.deepEqual(await executeExample("../../signal/README.md"), [["26.40"], [36], ["39.60"]]);
});

test("Signal README watcher establishes lazy dependencies and notifies", async () => {
	assert.deepEqual(await executeExample("../../signal/README.md", 2), [["Signal changed!"], [20]]);
});

test("effect README batches writes, then stops observing after disposal", async () => {
	assert.deepEqual(await executeExample("../README.md"), [["Count: 0"], ["Count: 2"]]);
});

test("collections README reacts to native-shaped array mutations", async () => {
	assert.deepEqual(await executeExample("../../collections/README.md"), [[20], [25], [23]]);
});

test("collections README avoids recomputation for an unrelated Map key", async () => {
	assert.deepEqual(await executeExample("../../collections/README.md", 2), [
		[3, 1],
		[3, 1],
		[2, 2],
	]);
});
