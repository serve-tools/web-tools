import type { Polyfill } from "../plugin/define-polyfill.js";

type Names = string | readonly string[];

const matchesName = (expected: Names, actual: string): boolean =>
	typeof expected === "string" ? actual === expected : expected.includes(actual);

const identifierPolyfill = (id: string, code: string, names: Names): Polyfill => ({
	id,
	code,
	detect: (found) => ({
		Identifier(node) {
			if (matchesName(names, node.name)) {
				found();
			}
		},
	}),
});

const memberPolyfill = (id: string, code: string, names: Names, owner?: string): Polyfill => ({
	id,
	code,
	detect: (found) => ({
		MemberExpression(node) {
			if (
				!node.computed &&
				node.property.type === "Identifier" &&
				matchesName(names, node.property.name) &&
				(owner === undefined || (node.object.type === "Identifier" && node.object.name === owner))
			) {
				found();
			}
		},
	}),
});

const MAP_UPSERT_RUNTIME = [
	`if(!Map.prototype.getOrInsert){`,
	`for(const{prototype:p}of[Map,WeakMap]){`,
	`const{constructor,...d}=Object.getOwnPropertyDescriptors(class{`,
	`getOrInsert(k,v){return this.has(k)?this.get(k):(this.set(k,v),v)}`,
	`getOrInsertComputed(k,c){return this.has(k)?this.get(k):(c=c(k),this.set(k,c),c)}`,
	`}.prototype);`,
	`Object.defineProperties(p,d)}}`,
].join("");

/** Ordered built-in polyfill definitions enabled when no explicit list is provided. */
export const builtinPolyfills: readonly Polyfill[] = [
	identifierPolyfill(
		"async-disposable-stack",
		`import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";` +
			`import"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose";` +
			`import"@serve-tools/polyfill-resource-management/apply/AsyncDisposableStack";`,
		"AsyncDisposableStack",
	),
	identifierPolyfill(
		"cancel-idle-callback",
		`import"@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback";`,
		"cancelIdleCallback",
	),
	identifierPolyfill("composite", `import"@serve-tools/polyfill-composites/apply/Composite";`, "Composite"),
	identifierPolyfill(
		"disposable-stack",
		`import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";` +
			`import"@serve-tools/polyfill-resource-management/apply/DisposableStack";`,
		"DisposableStack",
	),
	memberPolyfill("event-target-when", `import"@serve-tools/polyfill-observable/apply/EventTarget/when";`, "when"),
	memberPolyfill("map-upsert", MAP_UPSERT_RUNTIME, ["getOrInsert", "getOrInsertComputed"]),
	identifierPolyfill("observable", `import"@serve-tools/polyfill-observable/apply/Observable";`, "Observable"),
	identifierPolyfill(
		"request-idle-callback",
		`import"@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback";`,
		"requestIdleCallback",
	),
	identifierPolyfill(
		"scheduler",
		`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/scheduler";`,
		"scheduler",
	),
	identifierPolyfill("subscriber", `import"@serve-tools/polyfill-observable/apply/Subscriber";`, "Subscriber"),
	identifierPolyfill(
		"suppressed-error",
		`import"@serve-tools/polyfill-resource-management/apply/SuppressedError";`,
		"SuppressedError",
	),
	memberPolyfill(
		"symbol-async-dispose",
		`import"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose";`,
		"asyncDispose",
		"Symbol",
	),
	memberPolyfill(
		"symbol-dispose",
		`import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";`,
		"dispose",
		"Symbol",
	),
	memberPolyfill(
		"symbol-metadata",
		`import"@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";`,
		"metadata",
		"Symbol",
	),
	identifierPolyfill(
		"task-controller",
		`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskController";`,
		"TaskController",
	),
	identifierPolyfill(
		"task-signal",
		`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskSignal";` +
			`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskPriorityChangeEvent";`,
		["TaskSignal", "TaskPriorityChangeEvent"],
	),
	identifierPolyfill("url-pattern", `import"@serve-tools/polyfill-urlpattern";`, "URLPattern"),
];
