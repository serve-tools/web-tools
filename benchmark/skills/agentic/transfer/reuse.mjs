import { createHash } from "node:crypto";
import { parseAst } from "rolldown/parseAst";

/**
 * Describe recipe copying and structural helper retention without contributing to artifact grades.
 *
 * Structural equality intentionally ignores parser locations, raw literal spelling, and comments.
 * A retained declaration or an identifier occurrence is evidence about source shape only; it does not
 * establish that a helper executed or supplied the artifact's behavior.
 */
export function reuseEvidence(record, trace, source, condition) {
	const copies = trace
		.map((entry, traceIndex) => ({ entry, traceIndex }))
		.filter(
			({ entry }) =>
				entry.name === "copy_file" &&
				!entry.result.error &&
				Object.hasOwn(condition.scaffolds ?? {}, entry.args.path),
		);
	const finalLines = substantiveLines(source);
	const finalProgram = parseProgram(source);
	const details = copies.map(({ entry, traceIndex }) => {
		const recipe = condition.scaffolds[entry.args.path];
		const manifest = condition.recipeManifest?.find((candidate) => `recipes/${candidate.file}` === entry.args.path);
		const lines = substantiveLines(recipe);
		const retained = [...lines].filter((line) => finalLines.has(line)).length;
		const recipeProgram = parseProgram(recipe);
		const helpers = (manifest?.preservedSymbols ?? []).map((name) =>
			describeHelper(name, recipeProgram, finalProgram),
		);

		return {
			path: entry.args.path,
			traceIndex,
			uniqueSubstantiveLines: lines.size,
			retainedLines: retained,
			retainedFraction: lines.size ? retained / lines.size : 0,
			helpers,
		};
	});
	return {
		taskId: record.taskId,
		seed: record.seed,
		run: record.run,
		variant: record.variant,
		pass: record.pass,
		copiedRecipe: copies.length > 0,
		workflowErrors: trace.filter((entry) => entry.result.error && /recipe|workflow/.test(entry.result.error))
			.length,
		bestRetainedFraction: details.length ? Math.max(...details.map((detail) => detail.retainedFraction)) : null,
		finalParseError: finalProgram.error,
		details,
	};
}

function describeHelper(name, recipeProgram, finalProgram) {
	const sourceDeclaration = declarationFor(recipeProgram.ast, name);
	const finalDeclaration = declarationFor(finalProgram.ast, name);
	const sourceStructuralHash = sourceDeclaration ? structuralHash(sourceDeclaration) : null;
	const finalStructuralHash = finalDeclaration ? structuralHash(finalDeclaration) : null;

	return {
		name,
		sourceDeclarationFound: sourceDeclaration !== null,
		finalDeclarationFound: finalDeclaration !== null,
		structurallyRetained:
			sourceStructuralHash !== null &&
			finalStructuralHash !== null &&
			sourceStructuralHash === finalStructuralHash,
		finalExternalIdentifierOccurrencesOutsideDeclaration: finalDeclaration
			? externalIdentifierOccurrencesOutsideDeclaration(finalProgram.ast, name, finalDeclaration)
			: 0,
	};
}

function parseProgram(source) {
	try {
		return {
			ast: parseAst(source, { lang: "ts", astType: "js", sourceType: "module", preserveParens: false }),
			error: null,
		};
	} catch (error) {
		return { ast: null, error: error.message };
	}
}

function declarationFor(program, name) {
	if (!program) {
		return null;
	}
	for (const statement of program.body) {
		const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
		if (!declaration) {
			continue;
		}
		if (
			["FunctionDeclaration", "ClassDeclaration", "TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(
				declaration.type,
			) &&
			declaration.id?.name === name
		) {
			return declaration;
		}
		if (declaration.type !== "VariableDeclaration") {
			continue;
		}
		const declarator = declaration.declarations.find(
			(candidate) => candidate.id?.type === "Identifier" && candidate.id.name === name,
		);
		if (declarator) {
			return declarator;
		}
	}
	return null;
}

function externalIdentifierOccurrencesOutsideDeclaration(program, name, declaration) {
	let occurrences = 0;
	visit(program, (node) => {
		if (node === declaration) {
			return false;
		}
		if (node.type === "Identifier" && node.name === name) {
			++occurrences;
		}
		return true;
	});
	return occurrences;
}

function visit(value, callback) {
	if (!value || typeof value !== "object") {
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			visit(entry, callback);
		}
		return;
	}
	if (typeof value.type === "string" && callback(value) === false) {
		return;
	}
	for (const [key, nested] of Object.entries(value)) {
		if (ignoredAstKeys.has(key)) {
			continue;
		}
		visit(nested, callback);
	}
}

function structuralHash(node) {
	return createHash("sha256")
		.update(JSON.stringify(normalizeAst(node)))
		.digest("hex");
}

function normalizeAst(value) {
	if (typeof value === "bigint") {
		return { type: "bigint", value: value.toString() };
	}
	if (Array.isArray(value)) {
		return value.map(normalizeAst);
	}
	if (!value || typeof value !== "object") {
		return value;
	}
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !ignoredAstKeys.has(key))
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => [key, normalizeAst(nested)]),
	);
}

const ignoredAstKeys = new Set([
	"start",
	"end",
	"loc",
	"raw",
	"comments",
	"leadingComments",
	"trailingComments",
	"innerComments",
]);

function substantiveLines(source) {
	return new Set(
		source
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length >= 12 && !/^(\/\/|\/\*|\*|import\b)/.test(line)),
	);
}
