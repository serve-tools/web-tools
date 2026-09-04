/** The learner can only manipulate a virtual document collection and one artifact. */
export function createToolSession({ condition, check, maxActions = 32, maxChecks = 4 }) {
	let source = "";
	let actions = 0;
	let checks = 0;
	const trace = [];
	const checkResults = [];
	const documents = [];
	const fileMap = { ...condition.files, ...condition.scaffolds };
	let copiedRecipe = null;

	async function call(name, args) {
		const started = performance.now();
		++actions;
		let result;

		try {
			if (actions > maxActions) {
				throw new Error("Action budget exhausted; finish with the current artifact.");
			}
			switch (name) {
				case "list_files": {
					const matches = Object.keys(fileMap)
						.filter((file) => file.includes(args.query ?? ""))
						.sort();
					const offset = Math.max(0, args.offset ?? 0);
					result = {
						paths: matches.slice(offset, offset + 60),
						total: matches.length,
						nextOffset: offset + 60 < matches.length ? offset + 60 : null,
					};
					break;
				}
				case "search": {
					const query = args.query.toLowerCase();
					if (!query.trim()) {
						throw new Error("Supply a nonempty literal search query.");
					}
					const matches = [];
					for (const [file, content] of Object.entries(fileMap)) {
						if (args.pathPrefix && !file.startsWith(args.pathPrefix)) {
							continue;
						}
						for (const [index, line] of content.split("\n").entries()) {
							if (line.toLowerCase().includes(query)) {
								matches.push({ path: file, line: index + 1, text: line.slice(0, 400) });
							}
						}
					}
					const offset = Math.max(0, args.offset ?? 0);
					result = {
						matches: matches.slice(offset, offset + 25),
						total: matches.length,
						nextOffset: offset + 25 < matches.length ? offset + 25 : null,
					};
					break;
				}
				case "read_file": {
					const content = args.path === "solution.ts" ? source : fileMap[args.path];
					if (content === undefined) {
						throw new Error(`Unknown virtual path: ${args.path}`);
					}
					const lines = content.split("\n");
					const start = Math.max(0, (args.startLine ?? 1) - 1);
					const count = Math.min(220, Math.max(1, args.lineCount ?? 120));
					result = {
						path: args.path,
						startLine: start + 1,
						totalLines: lines.length,
						content: lines.slice(start, start + count).join("\n"),
					};
					documents.push(args.path);
					break;
				}
				case "copy_file": {
					if (fileMap[args.path] === undefined) {
						throw new Error(`Unknown virtual path: ${args.path}`);
					}
					// Any arm may copy an available file when its condition supplies reusable source.
					source = fileMap[args.path];
					if (Object.hasOwn(condition.scaffolds ?? {}, args.path) && args.path.endsWith(".ts")) {
						copiedRecipe = args.path;
					}
					result = { written: "solution.ts", characters: source.length };
					break;
				}
				case "write_solution": {
					if (condition.requireRecipeCopy && copiedRecipe === null) {
						throw new Error(
							"This workflow starts by copying a relevant .ts recipe with copy_file, then adapting it.",
						);
					}
					if (typeof args.source !== "string" || args.source.length > 80_000) {
						throw new Error("Source must be a string of at most 80000 characters.");
					}
					source = args.source;
					result = { written: "solution.ts", characters: source.length };
					break;
				}
				case "replace_solution": {
					if (condition.requireRecipeCopy && copiedRecipe === null) {
						throw new Error("Copy a relevant .ts recipe before adapting the artifact.");
					}
					const first = source.indexOf(args.before);
					if (!args.before || first < 0 || source.indexOf(args.before, first + 1) >= 0) {
						throw new Error("Replacement requires exactly one nonempty matching substring.");
					}
					source = source.slice(0, first) + args.after + source.slice(first + args.before.length);
					result = { written: "solution.ts", characters: source.length };
					break;
				}
				case "check": {
					if (++checks > maxChecks) {
						throw new Error("Public check budget exhausted; finish with the current artifact.");
					}
					result = await check(source);
					checkResults.push({ ...result, action: actions });
					break;
				}
				default:
					throw new Error(`Unknown tool: ${name}`);
			}
		} catch (error) {
			result = { error: error.message };
		}
		trace.push({ name, args, result, elapsedMs: performance.now() - started });
		return result;
	}

	return {
		call,
		get source() {
			return source;
		},
		get actions() {
			return actions;
		},
		get checks() {
			return checks;
		},
		trace,
		checkResults,
		documents,
	};
}

const string = { type: "string" };
const integer = { type: "integer" };

function tool(name, description, properties, required = Object.keys(properties)) {
	return {
		type: "function",
		name,
		description,
		inputSchema: { type: "object", properties, required, additionalProperties: false },
	};
}

export const toolSpecs = [
	tool(
		"list_files",
		"List virtual documentation/scaffold paths by substring; pagination is 60 paths. Empty query lists all. No host files are available.",
		{ query: string, offset: integer },
	),
	tool(
		"search",
		"Search virtual file contents by literal text (case-insensitive), optionally scoped by path prefix. Returns 25 matching lines per page.",
		{ query: string, pathPrefix: string, offset: integer },
	),
	tool(
		"read_file",
		"Read virtual docs, recipes, declarations, or current solution.ts. Lines start at 1, maximum 220 lines per call.",
		{ path: string, startLine: integer, lineCount: integer },
	),
	tool(
		"copy_file",
		"Copy an available virtual file directly into solution.ts without regenerating it. Then adapt with replace_solution or write_solution.",
		{ path: string },
	),
	tool("write_solution", "Write or replace the complete solution.ts artifact. Use the task's exact exports.", {
		source: string,
	}),
	tool(
		"replace_solution",
		"Replace one exact unique substring of solution.ts, avoiding re-emission of unchanged code.",
		{ before: string, after: string },
	),
	tool(
		"check",
		"Compile solution.ts and run public behavioral smoke tests. Returns diagnostic feedback for repair. Hidden checks never run through this tool.",
		{},
	),
];
