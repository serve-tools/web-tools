import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

type KeyboardCategory = {
	id: string;
	values: string[];
};

type KeyboardTypeGenerator = {
	formatGeneratedSource: (source: string, filePath: string) => string;
	generateKeyboardEventCode: (categories: KeyboardCategory[]) => string;
	generateKeyboardEventKey: (categories: KeyboardCategory[]) => string;
	parseCodeTables: (source: string) => KeyboardCategory[];
	parseKeyTables: (source: string) => KeyboardCategory[];
	sourceFixtures: {
		code: URL;
		key: URL;
	};
};

const generatorPath = new URL("../scripts/generate-keyboard-types.mjs", import.meta.url).href;
const {
	formatGeneratedSource,
	generateKeyboardEventCode,
	generateKeyboardEventKey,
	parseCodeTables,
	parseKeyTables,
	sourceFixtures,
} = (await import(generatorPath)) as KeyboardTypeGenerator;

const tableParsers = [
	{
		name: "physical code",
		parse: parseCodeTables,
		generate: generateKeyboardEventCode,
		begin: "BEGIN_CODE_TABLE",
		row: "CODE",
		optionalRow: "CODE_OPT",
		end: "END_CODE_TABLE",
		value: "KeyA",
	},
	{
		name: "logical key",
		parse: parseKeyTables,
		generate: generateKeyboardEventKey,
		begin: "BEGIN_KEY_TABLE",
		row: "KEY",
		optionalRow: "KEY_OPT",
		end: "END_KEY_TABLE",
		value: "Enter",
	},
] as const;

describe("keyboard type generation", (): void => {
	test("deterministically generates categorized types from pinned W3C fixtures", async (): Promise<void> => {
		const [codeFixture, keyFixture, committedCode, committedKey] = await Promise.all([
			readFile(sourceFixtures.code, "utf8"),
			readFile(sourceFixtures.key, "utf8"),
			readFile(new URL("../src/lib/keyboard-event-code.ts", import.meta.url), "utf8"),
			readFile(new URL("../src/lib/keyboard-event-key.ts", import.meta.url), "utf8"),
		]);

		const codeCategories = parseCodeTables(codeFixture);
		const keyCategories = parseKeyTables(keyFixture);
		const generatedCode = generateKeyboardEventCode(codeCategories);
		const generatedKey = generateKeyboardEventKey(keyCategories);

		expect(codeCategories).toHaveLength(13);
		expect(keyCategories).toHaveLength(22);
		expect(generateKeyboardEventCode(parseCodeTables(codeFixture))).toBe(generatedCode);
		expect(generateKeyboardEventKey(parseKeyTables(keyFixture))).toBe(generatedKey);
		expect(formatGeneratedSource(generatedCode, "keyboard-event-code.ts")).toBe(committedCode);
		expect(formatGeneratedSource(generatedKey, "keyboard-event-key.ts")).toBe(committedKey);
		expect(generatedCode).toContain("export type KeyboardEventCode");
		expect(generatedCode).toContain("namespace KeyboardEventCode");
		expect(generatedCode).toContain("AlphanumericWritingSystem");
		expect(generatedCode).toContain('"F24"');
		expect(generatedKey).toContain("export type KnownKeyboardEventKey");
		expect(generatedKey).toContain("namespace KeyboardEventKey");
		expect(generatedKey).toContain("ModifierLegacy");
		expect(generatedKey).toContain("MediaControllerDup");
		expect(generatedKey).toContain('"AudioVolumeUp"');
	});

	test("excludes printable characters from standardized named key categories", (): void => {
		const source = [
			"BEGIN_KEY_TABLE test",
			"KEY A",
			"KEY é",
			"KEY e\u0301",
			"KEY +",
			"KEY 🧑",
			"KEY 🧑‍💻",
			"KEY Enter",
			"END_KEY_TABLE",
		].join("\n");

		expect(parseKeyTables(source)).toEqual([{ id: "test", values: ["Enter"] }]);
	});

	test.each(["not-valid", "Arrow-Down"])("rejects malformed multi-character named logical key %s", (value): void => {
		const source = ["BEGIN_KEY_TABLE test", "KEY Enter", `KEY ${value}`, "END_KEY_TABLE"].join("\n");

		expect((): KeyboardCategory[] => parseKeyTables(source)).toThrow(/malformed/i);
	});

	test.each(["\u0000", "\u200d"])("rejects non-printable logical key code point %#", (value): void => {
		const source = ["BEGIN_KEY_TABLE test", "KEY Enter", `KEY ${value}`, "END_KEY_TABLE"].join("\n");

		expect((): KeyboardCategory[] => parseKeyTables(source)).toThrow(/malformed/i);
	});

	test.each(["é", "+", "🧑"])("rejects invalid physical code value %s", (value): void => {
		const source = ["BEGIN_CODE_TABLE test", "CODE KeyA", `CODE ${value}`, "END_CODE_TABLE"].join("\n");

		expect((): KeyboardCategory[] => parseCodeTables(source)).toThrow(/malformed/i);
	});

	test("preserves source-declared repeated media-controller key values", (): void => {
		const source = [
			"BEGIN_KEY_TABLE audio",
			"KEY AudioVolumeUp",
			"END_KEY_TABLE",
			"BEGIN_KEY_TABLE media-controller-dup",
			"KEY_DUP AudioVolumeUp",
			"END_KEY_TABLE",
		].join("\n");

		expect((): unknown => parseKeyTables(source)).not.toThrow();
	});

	test("rejects repeated logical keys without an original category", (): void => {
		const source = ["BEGIN_KEY_TABLE media-controller-dup", "KEY_DUP Enter", "END_KEY_TABLE"].join("\n");

		expect((): KeyboardCategory[] => parseKeyTables(source)).toThrow(/malformed duplicate/i);
	});

	describe.each(tableParsers)(
		"$name table parser",
		({ begin, end, generate, optionalRow, parse, row, value }): void => {
			test("accepts optional standardized values", (): void => {
				const source = [`${begin} test`, `${optionalRow} ${value}`, end].join("\n");

				expect(parse(source)).toEqual([{ id: "test", values: [value] }]);
			});

			test("rejects duplicate category names", (): void => {
				const source = [`${begin} test`, `${row} ${value}`, end, `${begin} test`].join("\n");

				expect((): KeyboardCategory[] => parse(source)).toThrow(/duplicate/i);
			});

			test("rejects duplicate values", (): void => {
				const source = [`${begin} test`, `${row} ${value}`, `${row} ${value}`, end].join("\n");

				expect((): unknown => parse(source)).toThrow(/duplicate/i);
			});

			test("rejects undeclared duplicates across categories", (): void => {
				const source = [
					`${begin} first`,
					`${row} ${value}`,
					end,
					`${begin} second`,
					`${row} ${value}`,
					end,
				].join("\n");

				expect((): unknown => parse(source)).toThrow(/duplicate/i);
			});

			test("rejects malformed rows", (): void => {
				const source = [`${begin} test`, row, end].join("\n");

				expect((): unknown => parse(source)).toThrow(/malformed/i);
			});

			test("rejects unrecognized rows inside otherwise valid tables", (): void => {
				const source = [`${begin} test`, `${row} ${value}`, `CORRUPT ${value}`, end].join("\n");

				expect((): unknown => parse(source)).toThrow(/malformed/i);
			});

			test("rejects unrecognized content outside tables", (): void => {
				const source = [`${begin} test`, `${row} ${value}`, end, "UNEXPECTED garbage"].join("\n");

				expect((): unknown => parse(source)).toThrow(/malformed/i);
			});

			test("rejects empty expected categories", (): void => {
				const source = [`${begin} test`, end].join("\n");

				expect((): unknown => parse(source)).toThrow(/empty/i);
			});

			test("rejects unterminated tables", (): void => {
				const source = [`${begin} test`, `${row} ${value}`].join("\n");

				expect((): unknown => parse(source)).toThrow(/malformed|unterminated/i);
			});

			test("rejects fixtures missing expected categories", (): void => {
				const source = [`${begin} test`, `${row} ${value}`, end].join("\n");

				expect((): string => generate(parse(source))).toThrow(/empty|missing/i);
			});
		},
	);
});
