import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileTypeScript,
	parseBenchmarkOptions,
	readNativeHeap,
	resolveTypeScript,
	timeEditorRequest,
	withNativeEditor,
	withTemporaryRoot,
} from "../../../benchmark/typescript/harness.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const typescript = resolveTypeScript(root);
const typescriptVersion = typescript.version;
const keyboardSource = path.join(root, "client", "keyboard", "src", "client-keyboard.js");
const scenarios = [
	"control",
	"physical-code",
	"known-key",
	"open-key",
	"open-chord",
	"open-calls",
	"known-chord",
	"open-handlers",
	"known-handlers",
];
const physicalCodes = ["KeyA", "KeyK", "Digit1", "Enter", "ArrowUp", "PageDown", "Numpad0", "F24"];
const knownKeys = [
	"Enter",
	"Tab",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"Backspace",
	"Delete",
	"Escape",
	"PageDown",
	"PageUp",
	"MediaPlayPause",
	"AudioVolumeUp",
	"BrowserBack",
	"F12",
	"F24",
];
const shortcuts = [
	...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
	...Array.from({ length: 10 }, (_, index) => String(index)),
	...knownKeys,
	"Space",
	"Comma",
	"Minus",
	"Period",
	"Plus",
];
const prefixes = Array.from({ length: 16 }, (_, bits) =>
	[bits & 8 ? "Mod+" : "", bits & 4 ? "Aux+" : "", bits & 2 ? "Alt+" : "", bits & 1 ? "Shift+" : ""].join(""),
);
const { counts: usages, editor } = parseBenchmarkOptions({
	arguments_: process.argv.slice(2),
	countFlag: "--usages",
	defaultCounts: "25,100,250",
	environment: "KEYBOARD_BENCHMARK_USAGES",
	help: "Usage: npm run benchmark:types -- [--usages 25,100,250] [--editor]",
	label: "usage counts",
});

await withTemporaryRoot("keyboard", async (temporaryRoot) => {
	for (const usage of usages) {
		const results = new Map();

		for (const scenario of scenarios) {
			const fixture = await createFixture(temporaryRoot, usage, scenario);
			const metrics = compileTypeScript({
				compiler: typescript.compiler,
				configuration: fixture.configuration,
				root,
			});
			const control = results.get("control");
			const openHandlers = results.get("open-handlers");
			const record = {
				name: `client-keyboard/types/${scenario}`,
				scenario,
				usages: usage,
				workload: usage > 100 ? "synthetic" : "representative",
				typescript: typescriptVersion,
				...metrics,
				...(control === undefined
					? {}
					: {
							controlAllocationRatio: Number(
								(metrics.memoryAllocations / control.memoryAllocations).toFixed(3),
							),
							controlInstantiationDelta: metrics.instantiations - control.instantiations,
						}),
				...(scenario === "known-handlers" && openHandlers !== undefined
					? {
							strictAllocationRatio: Number(
								(metrics.memoryAllocations / openHandlers.memoryAllocations).toFixed(3),
							),
							strictInstantiationDelta: metrics.instantiations - openHandlers.instantiations,
						}
					: {}),
			};

			results.set(scenario, record);
			console.log(`[benchmark:types] ${JSON.stringify(record)}`);

			if (editor && (scenario === "open-handlers" || scenario === "known-handlers")) {
				await benchmarkEditor(temporaryRoot, fixture, usage, scenario);
			}
		}
	}
});

async function createFixture(temporaryRoot, count, scenario) {
	const stem = `${scenario}-${count}`;
	const source = path.join(temporaryRoot, `${stem}.ts`);
	const configuration = path.join(temporaryRoot, `${stem}.json`);
	const declarations = [];
	const handlers = [];
	const isHandlerScenario = scenario === "open-handlers" || scenario === "known-handlers";

	for (let index = 0; index < count; ++index) {
		const physicalCode = physicalCodes[index % physicalCodes.length];
		const knownKey = knownKeys[index % knownKeys.length];
		const chord =
			prefixes[Math.floor(index / shortcuts.length) % prefixes.length] + shortcuts[index % shortcuts.length];
		const openKey = index % 3 === 0 ? `FutureKeyboardAction${index}` : index % 3 === 1 ? "é" : knownKey;
		const openChord = index % 4 === 0 ? `Mod+FutureKeyboardAction${index}` : index % 4 === 1 ? "Mod+é" : chord;

		if (scenario === "control") {
			declarations.push(`const shortcut${index}: string = ${JSON.stringify(chord)};`);
		} else if (scenario === "physical-code") {
			declarations.push(`const shortcut${index}: KeyboardEventCode = ${JSON.stringify(physicalCode)};`);
		} else if (scenario === "known-key") {
			declarations.push(`const shortcut${index}: KnownKeyboardEventKey = ${JSON.stringify(knownKey)};`);
		} else if (scenario === "open-key") {
			declarations.push(`const shortcut${index}: KeyboardEventKey = ${JSON.stringify(openKey)};`);
		} else if (scenario === "open-chord") {
			declarations.push(`const shortcut${index}: KeyChord = ${JSON.stringify(openChord)};`);
		} else if (scenario === "open-calls") {
			declarations.push(
				`matchKeyChord(${JSON.stringify(openChord)}, event); getKeyChordLabel(${JSON.stringify(openChord)});`,
			);
		} else if (scenario === "known-chord") {
			declarations.push(`const shortcut${index}: KnownKeyChord = ${JSON.stringify(chord)};`);
		} else {
			const shortcut = scenario === "open-handlers" ? openChord : chord;
			handlers.push(
				`[${JSON.stringify(shortcut)}, (event) => { if (matchKeyChord(${JSON.stringify(shortcut)}, event)) event.preventDefault(); }],`,
			);
		}
	}

	const sections = [
		`import type { KeyboardEventCode, KeyboardEventKey, KeyChord, KnownKeyboardEventKey, KnownKeyChord } from ${JSON.stringify(keyboardSource)};`,
		`import { getKeyChord, getKeyChordLabel, matchKeyChord } from ${JSON.stringify(keyboardSource)};`,
		...(scenario === "open-calls" ? ["declare const event: KeyboardEvent;"] : []),
		...declarations,
		...(isHandlerScenario
			? [
					`const shortcuts = new Map<${scenario === "known-handlers" ? "KnownKeyChord" : "KeyChord"}, (event: KeyboardEvent) => void>([`,
					...handlers,
					"]);",
					'window.addEventListener("keydown", (event) => {',
					"const chord = getKeyChord(event);",
					`if (chord) shortcuts.get(chord${scenario === "known-handlers" ? " as KnownKeyChord" : ""})?.(event);`,
					"});",
					'const physicalCompletion: KeyboardEventCode = /* physical-completion */"KeyA";',
					'const knownKeyCompletion: KnownKeyboardEventKey = /* known-key-completion */"Enter";',
					'const openKeyCompletion: KeyboardEventKey = /* open-key-completion */"Enter";',
					'const knownChordCompletion: KnownKeyChord = /* known-chord-completion */"Mod+AudioVolumeUp";',
					'const openChordCompletion: KeyChord = /* open-chord-completion */"Mod+AudioVolumeUp";',
				]
			: []),
	];
	const contents = `${sections.join("\n")}\n`;
	const config = {
		extends: path.join(root, "tsconfig.json"),
		compilerOptions: {
			composite: false,
			declaration: false,
			incremental: false,
			lib: ["ES2025", "DOM", "DOM.Iterable"],
			noEmit: true,
			skipLibCheck: true,
			strict: true,
			types: [],
		},
		files: [source],
		include: [],
	};

	await Promise.all([
		writeFile(source, contents),
		writeFile(configuration, `${JSON.stringify(config, undefined, "\t")}\n`),
	]);

	return { configuration, contents, source };
}

async function benchmarkEditor(temporaryRoot, fixture, usages, scenario) {
	const record = await withNativeEditor({
		editor: typescript.editor,
		fixture,
		projectError: "The TypeScript editor did not load the keyboard benchmark project",
		root,
		run: ({ api, project }) => {
			const { result: diagnostics, timing: diagnosticTiming } = timeEditorRequest(api, () =>
				project.program.getSemanticDiagnostics(fixture.source),
			);
			if (diagnostics.length !== 0) {
				throw new Error(`The TypeScript editor reported ${diagnostics.length} semantic diagnostics`);
			}

			const completions = [
				readCompletion(api, project, fixture, "physical", "KeyA"),
				readCompletion(api, project, fixture, "known-key", "Enter"),
				readCompletion(api, project, fixture, "open-key", "Enter"),
				readCompletion(api, project, fixture, "known-chord", "Mod+AudioVolumeUp"),
				readCompletion(api, project, fixture, "open-chord", "Mod+AudioVolumeUp"),
			];
			if (completions[3].entries !== completions[4].entries || completions[3].entries < 100) {
				throw new Error("Open and strict keyboard chords did not provide matching known-key completions");
			}
			const profile = api.internal.saveHeapProfile(temporaryRoot);
			return {
				name: "client-keyboard/types/editor",
				scenario,
				usages,
				workload: usages > 100 ? "synthetic" : "representative",
				typescript: typescriptVersion,
				diagnosticServerMilliseconds: diagnosticTiming.totals.serverTimeMs,
				diagnosticRoundTripMilliseconds: diagnosticTiming.totals.roundTripMs,
				completions,
				nativeHeapBytes: readNativeHeap({ profile, root, sample: "inuse_space" }),
				nativeAllocatedBytes: readNativeHeap({ profile, root, sample: "alloc_space" }),
			};
		},
	});

	console.log(`[benchmark:types] ${JSON.stringify(record)}`);
}

function readCompletion(api, project, fixture, name, expected) {
	const marker = `/* ${name}-completion */`;
	const markerPosition = fixture.contents.indexOf(marker);
	if (markerPosition < 0) {
		throw new Error(`The TypeScript benchmark is missing the ${name} completion marker`);
	}

	const { result: completions, timing } = timeEditorRequest(api, () =>
		project.checker.getCompletionsAtPosition(fixture.source, markerPosition + marker.length + 1),
	);
	if (!completions?.entries.some((entry) => entry.name === expected)) {
		throw new Error(`The TypeScript editor did not provide the expected ${name} completion: ${expected}`);
	}

	return {
		name,
		serverMilliseconds: timing.totals.serverTimeMs,
		roundTripMilliseconds: timing.totals.roundTripMs,
		entries: completions.entries.length,
	};
}
