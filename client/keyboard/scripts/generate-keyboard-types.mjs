import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRevisions = {
	code: "b201684d1de0af90bc403814bbdee6aa96647130",
	key: "140cae88d6039b3fb1a51787978678115111c433",
};

const printableKeySegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const codeCategoryNames = {
	"alphanumeric-writing-system": "AlphanumericWritingSystem",
	"alphanumeric-functional-1": "AlphanumericFunctional1",
	"alphanumeric-functional-2": "AlphanumericFunctional2",
	controlpad: "Controlpad",
	arrowpad: "Arrowpad",
	numpad: "Numpad",
	function: "Function",
	media: "Media",
	"legacy-modifier": "LegacyModifier",
	"legacy-process": "LegacyProcess",
	"legacy-editing": "LegacyEditing",
	international: "International",
	special: "Special",
};

const keyCategoryNames = {
	general: "General",
	modifier: "Modifier",
	"modifier-legacy": "ModifierLegacy",
	whitespace: "Whitespace",
	navigation: "Navigation",
	editing: "Editing",
	ui: "Ui",
	device: "Device",
	composition: "Composition",
	"ime-korean": "ImeKorean",
	"ime-japanese": "ImeJapanese",
	function: "Function",
	multimedia: "Multimedia",
	"multimedia-numpad": "MultimediaNumpad",
	audio: "Audio",
	speech: "Speech",
	apps: "Apps",
	browser: "Browser",
	"mobile-phone": "MobilePhone",
	tv: "Tv",
	"media-controller": "MediaController",
	"media-controller-dup": "MediaControllerDup",
};

/** Checked-in normalized snapshots of the pinned upstream W3C source tables. */
export const sourceFixtures = {
	code: new URL("./fixtures/uievents-code.txt", import.meta.url),
	key: new URL("./fixtures/uievents-key.txt", import.meta.url),
};

/** Parse standardized physical-key code tables from their W3C macro source. */
export const parseCodeTables = (source) => parseTables(source, "CODE");

/** Parse standardized named logical-key tables from their W3C macro source. */
export const parseKeyTables = (source) => parseTables(source, "KEY");

/** Generate the closed, categorized physical-key code module. */
export const generateKeyboardEventCode = (categories) => {
	validateCategories(categories, codeCategoryNames, "code");

	const functional = categories.find((category) => category.id === "alphanumeric-functional-1");
	const modifierValues = functional.values.filter((value) => /^(Alt|Control|Meta|Shift)(Left|Right)$/.test(value));

	if (modifierValues.length !== 8) {
		throw new Error("Malformed code category: expected eight left/right modifier codes.");
	}

	const generatedCategories = [{ name: "Modifier", values: modifierValues }];

	for (const category of categories) {
		let values = category.values;

		if (category.id === "alphanumeric-functional-1") {
			values = values.filter((value) => !modifierValues.includes(value));
		}

		if (category.id === "function") {
			values = expandFunctionKeys(values);
		}

		generatedCategories.push({ name: codeCategoryNames[category.id], values });
	}

	return generateModule({
		kind: "code",
		categories: generatedCategories,
		typeName: "KeyboardEventCode",
		open: false,
	});
};

/** Generate the categorized named-key union and its extensible browser-key type. */
export const generateKeyboardEventKey = (categories) => {
	validateCategories(categories, keyCategoryNames, "key");

	return generateModule({
		kind: "key",
		categories: categories.map((category) => ({
			name: keyCategoryNames[category.id],
			values: category.id === "function" ? expandFunctionKeys(category.values) : category.values,
		})),
		typeName: "KeyboardEventKey",
		open: true,
	});
};

/** Format generated TypeScript with the repository's installed Biome binary. */
export const formatGeneratedSource = (source, filePath = "keyboard-event.ts") => {
	const biomePath = fileURLToPath(new URL("../../../node_modules/.bin/biome", import.meta.url));
	const packageRoot = fileURLToPath(new URL("../", import.meta.url));

	return execFileSync(biomePath, ["format", "--stdin-file-path", filePath], {
		cwd: packageRoot,
		encoding: "utf8",
		input: source,
	});
};

const parseTables = (source, kind) => {
	if (typeof source !== "string") {
		throw new TypeError(`Malformed ${kind.toLowerCase()} source: expected a string.`);
	}

	const categories = [];
	const categoriesById = new Set();
	const firstCategoryByValue = new Map();
	const startExpression = new RegExp(`^BEGIN_${kind}_TABLE\\s+([a-z][a-z0-9-]*)(?:\\s+.*)?$`);
	const rowExpression =
		kind === "CODE" ? /^(CODE(?:_OPT)?)\s+(\S+)(?:\s+.*)?$/ : /^(KEY(?:_DUP)?(?:_OPT)?)\s+(\S+)(?:\s+.*)?$/;
	let activeCategory;

	for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
		const line = rawLine.trim();
		const lineNumber = index + 1;

		if (!line || line.startsWith("#")) {
			continue;
		}

		if (line.startsWith(`BEGIN_${kind}_TABLE`)) {
			const match = line.match(startExpression);

			if (!match || activeCategory) {
				throw new Error(`Malformed ${kind.toLowerCase()} table at line ${lineNumber}.`);
			}

			if (categoriesById.has(match[1])) {
				throw new Error(`Duplicate ${kind.toLowerCase()} table category "${match[1]}".`);
			}

			activeCategory = { id: match[1], values: [], seen: new Set() };
			categoriesById.add(match[1]);
			continue;
		}

		if (line === `END_${kind}_TABLE`) {
			if (!activeCategory) {
				throw new Error(`Malformed ${kind.toLowerCase()} table: unexpected end at line ${lineNumber}.`);
			}

			if (activeCategory.values.length === 0) {
				throw new Error(`Empty ${kind.toLowerCase()} table category "${activeCategory.id}".`);
			}

			categories.push({ id: activeCategory.id, values: activeCategory.values });
			activeCategory = undefined;
			continue;
		}

		if (!activeCategory) {
			throw new Error(`Malformed ${kind.toLowerCase()} table: unexpected content at line ${lineNumber}.`);
		}

		const match = line.match(rowExpression);

		if (!match) {
			throw new Error(`Malformed ${kind.toLowerCase()} table row at line ${lineNumber}.`);
		}

		const [, token, value] = match;

		if (kind === "KEY" && !/^\p{C}/u.test(value)) {
			const segments = printableKeySegmenter.segment(value)[Symbol.iterator]();

			segments.next();

			if (segments.next().done) {
				continue;
			}
		}

		if (!/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
			throw new Error(`Malformed ${kind.toLowerCase()} value "${value}" at line ${lineNumber}.`);
		}

		if (activeCategory.seen.has(value)) {
			throw new Error(`Duplicate ${kind.toLowerCase()} value "${value}" in category "${activeCategory.id}".`);
		}

		const originalCategory = firstCategoryByValue.get(value);
		const isExplicitDuplicate = token.includes("_DUP");

		if (originalCategory && !isExplicitDuplicate) {
			throw new Error(
				`Duplicate ${kind.toLowerCase()} value "${value}" in categories "${originalCategory}" and "${activeCategory.id}".`,
			);
		}

		if (isExplicitDuplicate && !originalCategory) {
			throw new Error(`Malformed duplicate ${kind.toLowerCase()} value "${value}": no original category exists.`);
		}

		activeCategory.seen.add(value);
		activeCategory.values.push(value);

		if (!originalCategory) {
			firstCategoryByValue.set(value, activeCategory.id);
		}
	}

	if (activeCategory) {
		throw new Error(`Malformed ${kind.toLowerCase()} table: category "${activeCategory.id}" is not closed.`);
	}

	if (categories.length === 0) {
		throw new Error(`Empty ${kind.toLowerCase()} source: no value tables were found.`);
	}

	return categories;
};

const validateCategories = (categories, expectedNames, kind) => {
	if (!Array.isArray(categories)) {
		throw new TypeError(`Malformed ${kind} categories: expected an array.`);
	}

	const categoriesById = new Map(categories.map((category) => [category.id, category]));

	for (const id of Object.keys(expectedNames)) {
		const category = categoriesById.get(id);

		if (!category || !Array.isArray(category.values) || category.values.length === 0) {
			throw new Error(`Empty or missing expected ${kind} category "${id}".`);
		}
	}

	for (const category of categories) {
		if (!Object.hasOwn(expectedNames, category.id)) {
			throw new Error(`Malformed ${kind} categories: unknown table "${category.id}".`);
		}
	}
};

const expandFunctionKeys = (values) => {
	const finalTableFunctionIndex = values.indexOf("F12");

	if (finalTableFunctionIndex === -1) {
		throw new Error("Malformed function category: expected the standard F1 through F12 table.");
	}

	// Both W3C specifications define F13 and later as open-ended numbered
	// families beyond their F1-F12 tables. Enumerate the conventional F1-F24
	// hardware range for the intentionally finite known-value unions; values
	// beyond F24 remain valid through the open logical-key and chord types.
	const conventionalFunctionKeys = Array.from({ length: 12 }, (_, index) => `F${index + 13}`);

	return values.toSpliced(finalTableFunctionIndex + 1, 0, ...conventionalFunctionKeys);
};

const generateModule = ({ kind, categories, typeName, open }) => {
	const knownTypeName = open ? "KnownKeyboardEventKey" : typeName;
	const namespaceTypes = categories.map((category) => `${typeName}.${category.name}`);
	const lines = [
		`/** Generated from the pinned W3C UI Events KeyboardEvent.${kind} value tables. */`,
		`// Source: https://github.com/w3c/uievents-${kind}/blob/${sourceRevisions[kind]}/index-source.txt`,
		"// Regenerate: npm run generate:keyboard-types --workspace @serve-tools/client-keyboard",
		"",
		`/** Standardized ${open ? "named logical" : "physical"} keyboard ${kind} values. */`,
		...formatUnion(`export type ${knownTypeName}`, namespaceTypes),
		"",
	];

	if (open) {
		lines.push(
			"/** Standardized named keys plus printable, international, and future browser key strings. */",
			"export type KeyboardEventKey = KnownKeyboardEventKey | KeyboardEventKey.KeyString;",
			"",
		);
	}

	lines.push(`export namespace ${typeName} {`);

	if (open) {
		lines.push(
			"\t/** Any printable, international, or future browser key string. */",
			"\texport type KeyString = string & {};",
		);
	}

	for (const [index, category] of categories.entries()) {
		if (open || index !== 0) {
			lines.push("");
		}

		lines.push(`\t/** Standardized ${kind} values in the ${category.name} category. */`);
		lines.push(
			...formatUnion(
				`\texport type ${category.name}`,
				category.values.map((value) => JSON.stringify(value)),
				"\t",
			),
		);
	}

	lines.push("}", "");

	return lines.join("\n");
};

const formatUnion = (declaration, members, indent = "") => {
	if (members.length === 1) {
		return [`${declaration} = ${members[0]};`];
	}

	return [
		`${declaration} =`,
		...members.map((value, index) => `${indent}\t| ${value}${index + 1 === members.length ? ";" : ""}`),
	];
};

const validateFixtureRevision = (source, kind) => {
	const revision = sourceRevisions[kind];
	const expectedSource = `# Source: https://github.com/w3c/uievents-${kind}/blob/${revision}/index-source.txt`;

	if (!source.startsWith(`${expectedSource}\n# Revision: ${revision}\n`)) {
		throw new Error(`Malformed ${kind} fixture provenance: expected pinned upstream revision ${revision}.`);
	}
};

const main = async () => {
	const [codeSource, keySource] = await Promise.all([
		readFile(sourceFixtures.code, "utf8"),
		readFile(sourceFixtures.key, "utf8"),
	]);

	validateFixtureRevision(codeSource, "code");
	validateFixtureRevision(keySource, "key");

	const codeOutput = new URL("../src/lib/keyboard-event-code.ts", import.meta.url);
	const keyOutput = new URL("../src/lib/keyboard-event-key.ts", import.meta.url);

	await Promise.all([
		writeFile(
			codeOutput,
			formatGeneratedSource(generateKeyboardEventCode(parseCodeTables(codeSource)), fileURLToPath(codeOutput)),
		),
		writeFile(
			keyOutput,
			formatGeneratedSource(generateKeyboardEventKey(parseKeyTables(keySource)), fileURLToPath(keyOutput)),
		),
	]);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	await main();
}
