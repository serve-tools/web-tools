import { readFileSync } from "node:fs";
import type { TransformMeta } from "@jsxtools/rolldown-transform";
import { rolldownTransform } from "@jsxtools/rolldown-transform";

const PLUGIN_NAME = "rolldown-decorators";
const RUNTIME_ID = "virtual:@serve-tools/rolldown-decorators/runtime";
const RESOLVED_RUNTIME_ID = `\0${RUNTIME_ID}`;
const SCRIPT_MODULE_TYPES = new Set(["js", "jsx", "ts", "tsx"]);

const enum Helper {
	CreatePrivate = 1,
	InitClass = 2,
	InitExtra = 4,
	InitInstance = 8,
	InitValue = 16,
}

const enum Kind {
	CLASS,
	METHOD,
	FIELD,
	ACCESSOR,
	GETTER,
	SETTER,
}

type Node = {
	readonly type: string;
	readonly start: number;
	readonly end: number;
	readonly [key: string]: unknown;
};

type Decorator = Node & { readonly expression: Node };

type Member = Node & {
	readonly decorators: readonly Decorator[];
	readonly key: Node;
	readonly computed: boolean;
	readonly static: boolean;
	readonly value?: Node | null;
	readonly kind?: string;
};

type ClassNode = Node & {
	readonly body: Node & { readonly body: readonly Member[] };
	readonly decorators: readonly Decorator[];
	readonly id: (Node & { readonly name: string }) | null;
	readonly superClass: Node | null;
};

type ClassRecord = { readonly node: ClassNode; readonly parent: Node | null };

type Helpers = {
	readonly apply: string;
	readonly createPrivate: string;
	readonly initClass: string;
	readonly initExtra: string;
	readonly initInstance: string;
	readonly initValue: string;
};

type RolldownMagicString = TransformMeta["magicString"];

type TransformState = {
	readonly code: string;
	readonly helpers: Helpers;
	readonly magicString: RolldownMagicString;
	readonly names: Set<string>;
	neededHelpers: number;
};

/** A Rolldown and Vite plugin that lowers standard TC39 decorator syntax. */
export interface RolldownDecoratorsPlugin {
	/** Stable `rolldown-decorators` plugin name reported to Rolldown and Vite. */
	readonly name: typeof PLUGIN_NAME;

	/** Return decorator runtime source for its resolved virtual module, or `null`. */
	load(id: string): string | null;

	/** Resolve the decorator runtime's virtual module, or return `null`. */
	resolveId(id: string): string | null;

	/** Cross-compatible pre-transform hook that lowers decorators in script modules. */
	readonly transform: ReturnType<typeof rolldownTransform>;
}

/** Create a Rolldown and Vite plugin that transforms standard TC39 decorators. */
export function rolldownDecorators(): RolldownDecoratorsPlugin {
	return {
		name: PLUGIN_NAME,
		resolveId(id) {
			return id === RUNTIME_ID ? RESOLVED_RUNTIME_ID : null;
		},
		load(id) {
			return id === RESOLVED_RUNTIME_ID
				? readFileSync(new URL("./decorators.js", import.meta.url), "utf8")
				: null;
		},
		transform: rolldownTransform({
			filter: { code: "@" },
			order: "pre",
			handler(code, id, meta) {
				if (!SCRIPT_MODULE_TYPES.has(meta.moduleType) || !code.includes("@")) {
					return null;
				}

				const { decorated, names } = analyzeProgram(meta.ast as unknown as Node);

				if (decorated.length === 0) {
					return null;
				}

				const helpers = {
					apply: uniqueName(names, "__decorators_apply"),
					createPrivate: uniqueName(names, "__decorators_private"),
					initClass: uniqueName(names, "__decorators_init_class"),
					initExtra: uniqueName(names, "__decorators_init_extra"),
					initInstance: uniqueName(names, "__decorators_init_instance"),
					initValue: uniqueName(names, "__decorators_init_value"),
				};

				const state: TransformState = {
					code,
					helpers,
					magicString: meta.magicString,
					names,
					neededHelpers: 0,
				};

				for (const record of decorated) {
					if (record.node.type === "ClassExpression") {
						throw new SyntaxError(
							`[${PLUGIN_NAME}] Decorated class expressions are not supported yet in ${id}`,
						);
					}

					transformClass(record, state);
				}

				state.magicString.prepend(createRuntimeImport(state));

				return { code: state.magicString };
			},
		}),
	};
}

function transformClass({ node, parent }: ClassRecord, state: TransformState): void {
	const { code, helpers, magicString, names } = state;
	const evaluations: Array<{ readonly start: number; readonly declaration: string }> = [];
	const declarations: string[] = [];
	const entries: string[] = [];
	const seeds: string[] = [];
	const className = node.id?.name;
	const owner = uniqueName(names, `__decorators_${className ?? "default"}`);

	let needsInstanceInitializers = false;
	let insertionStart = parent?.type.startsWith("Export") ? parent.start : node.start;

	declarations.push(`let ${owner};`);

	for (const decorator of node.decorators) {
		const temporary = cacheExpression(decorator.expression, evaluations, state);

		entries.push(`[[${temporary}],${Kind.CLASS},${className ? JSON.stringify(className) : "this.name"}]`);

		insertionStart = Math.min(insertionStart, decorator.start);

		magicString.remove(decorator.start, decorator.end);
	}

	for (const member of node.body.body) {
		if (member.decorators.length === 0) {
			continue;
		}

		const kind = kindOf(member);
		const privateMember = member.key.type === "PrivateIdentifier";
		const name = memberName(member, evaluations, state);
		const decorators = member.decorators.map((decorator) =>
			cacheExpression(decorator.expression, evaluations, state),
		);

		let controller: string | undefined;

		if (privateMember) {
			controller = uniqueName(names, `__decorators_${String(member.key.name ?? "private")}`);

			declarations.push(`const ${controller}=${helpers.createPrivate}(${kind});`);

			state.neededHelpers |= Helper.CreatePrivate;
		}

		entries.push(
			`[[${decorators.join(",")}],${kind},${name.expression},${member.static},${privateMember}${controller ? `,${controller}` : ""}]`,
		);

		if (kind === Kind.FIELD) {
			transformField(member, name, controller, owner, state);
		} else if (kind === Kind.ACCESSOR) {
			transformAutoAccessor(member, name, controller, owner, state);
		} else if (privateMember && controller) {
			seeds.push(`${controller}.r(${memberFunction(member, code)});`);
			transformPrivateCallable(member, controller, state);
		} else {
			removeDecorators(member, magicString);

			if (member.computed) {
				magicString.overwrite(member.key.start, member.key.end, name.reference);
			}
		}

		if (!member.static && kind !== Kind.FIELD && kind !== Kind.ACCESSOR) {
			needsInstanceInitializers = true;
		}
	}

	if (entries.length === 0) {
		return;
	}

	const staticBlock = `static{${seeds.join("")}${owner}=${helpers.apply}(this,${entries.join(",")});}`;
	const instanceInitializer = needsInstanceInitializers
		? `#${uniquePrivateName(names, "__decorators_init")}=${helpers.initInstance}(this,${owner});`
		: "";

	if (needsInstanceInitializers) {
		state.neededHelpers |= Helper.InitInstance;
	}

	magicString.appendLeft(node.body.start + 1, staticBlock + instanceInitializer);

	const prelude = [
		...evaluations.sort((left, right) => left.start - right.start).map(({ declaration }) => declaration),
		...declarations,
	].join("");

	magicString.prependLeft(insertionStart, prelude);

	if (node.decorators.length > 0) {
		state.neededHelpers |= Helper.InitClass;

		if (className) {
			magicString.appendRight(node.end, `${className}=${helpers.initClass}(${className});`);
		} else {
			magicString.prependLeft(node.start, `${helpers.initClass}(`);
			magicString.appendRight(node.end, ")");
		}
	}
}

function transformField(
	member: Member,
	name: MemberName,
	controller: string | undefined,
	owner: string,
	state: TransformState,
): void {
	const { code, helpers, magicString } = state;
	const value = member.value ? `(${code.slice(member.value.start, member.value.end)})` : "void 0";
	const initialized = `${helpers.initValue}(this,${controller ?? name.expression},${value},${owner},${member.static})`;

	state.neededHelpers |= Helper.InitValue;

	if (controller) {
		const staticKeyword = member.static ? "static " : "";
		const initName = uniquePrivateName(state.names, "__decorators_value");
		const key = name.syntax;

		magicString.overwrite(
			member.start,
			member.end,
			`${staticKeyword}#${initName}=${initialized};${staticKeyword}get ${key}(){return ${controller}.g(this);}${staticKeyword}set ${key}(value){${controller}.s(this,value);}`,
		);

		return;
	}

	removeDecorators(member, magicString);

	if (member.computed) {
		magicString.overwrite(member.key.start, member.key.end, name.reference);
	}

	if (member.value) {
		magicString.overwrite(member.value.start, member.value.end, initialized);
	} else {
		const end = code[member.end - 1] === ";" ? member.end - 1 : member.end;

		magicString.appendLeft(end, `=${initialized}`);
	}

	const extraName = uniquePrivateName(state.names, "__decorators_extra");
	const staticKeyword = member.static ? "static " : "";

	magicString.appendRight(
		member.end,
		`;${staticKeyword}#${extraName}=${helpers.initExtra}(this,${name.expression},${owner},${member.static});`,
	);

	state.neededHelpers |= Helper.InitExtra;
}

function transformAutoAccessor(
	member: Member,
	name: MemberName,
	controller: string | undefined,
	owner: string,
	state: TransformState,
): void {
	const { code, helpers, magicString, names } = state;
	const value = member.value ? `(${code.slice(member.value.start, member.value.end)})` : "void 0";
	const initialized = `${helpers.initValue}(this,${controller ?? name.expression},${value},${owner},${member.static})`;
	const staticKeyword = member.static ? "static " : "";
	const key = name.syntax;

	state.neededHelpers |= Helper.InitValue;

	if (controller) {
		const initName = uniquePrivateName(names, "__decorators_value");

		magicString.overwrite(
			member.start,
			member.end,
			`${staticKeyword}#${initName}=${initialized};${staticKeyword}get ${key}(){return ${controller}.g(this);}${staticKeyword}set ${key}(value){${controller}.s(this,value);}`,
		);

		return;
	}

	const backing = uniquePrivateName(names, "__decorators_accessor");
	const extra = uniquePrivateName(names, "__decorators_extra");

	magicString.overwrite(
		member.start,
		member.end,
		`${staticKeyword}#${backing}=${initialized};${staticKeyword}#${extra}=${helpers.initExtra}(this,${name.expression},${owner},${member.static});${staticKeyword}get ${key}(){return this.#${backing};}${staticKeyword}set ${key}(value){this.#${backing}=value;}`,
	);

	state.neededHelpers |= Helper.InitExtra;
}

function transformPrivateCallable(member: Member, controller: string, state: TransformState): void {
	const body = member.value && asNode(member.value.body);

	if (!body) {
		throw new SyntaxError(`[${PLUGIN_NAME}] A decorated private ${member.kind ?? "method"} requires a body`);
	}

	removeDecorators(member, state.magicString);

	if (member.kind === "get") {
		state.magicString.overwrite(body.start, body.end, `{return ${controller}.g(this);}`);
	} else if (member.kind === "set") {
		state.magicString.overwrite(body.start, body.end, `{${controller}.s(this,arguments[0]);}`);
	} else {
		const delegate = member.value?.generator
			? `yield* ${controller}.g(this)(...arguments);`
			: `return ${controller}.g(this)(...arguments);`;

		state.magicString.overwrite(body.start, body.end, `{${delegate}}`);
	}
}

function memberFunction(member: Member, code: string): string {
	const value = member.value;

	if (!value) {
		return "function(){}";
	}

	const asyncKeyword = value.async ? "async " : "";
	const generator = value.generator ? "*" : "";

	return `${asyncKeyword}function${generator}${code.slice(value.start, value.end)}`;
}

type MemberName = { readonly expression: string; readonly reference: string; readonly syntax: string };

function memberName(
	member: Member,
	evaluations: Array<{ start: number; declaration: string }>,
	state: TransformState,
): MemberName {
	const { key } = member;

	if (member.computed) {
		const temporary = cacheExpression(key, evaluations, state, "__decorators_name");

		return { expression: temporary, reference: temporary, syntax: `[${temporary}]` };
	}

	if (key.type === "PrivateIdentifier") {
		const value = `#${String(key.name)}`;

		return { expression: JSON.stringify(value), reference: value, syntax: value };
	}

	const source = state.code.slice(key.start, key.end);
	const value = key.type === "Identifier" ? String(key.name) : String(key.value);

	return { expression: JSON.stringify(value), reference: source, syntax: source };
}

function cacheExpression(
	expression: Node,
	evaluations: Array<{ start: number; declaration: string }>,
	state: TransformState,
	base = "__decorators_expression",
): string {
	const name = uniqueName(state.names, base);

	evaluations.push({
		start: expression.start,
		declaration: `const ${name}=${state.code.slice(expression.start, expression.end)};`,
	});

	return name;
}

function kindOf(member: Member): Kind {
	if (member.type === "AccessorProperty") {
		return Kind.ACCESSOR;
	}

	if (member.type === "PropertyDefinition") {
		return Kind.FIELD;
	}

	if (member.kind === "get") {
		return Kind.GETTER;
	}

	if (member.kind === "set") {
		return Kind.SETTER;
	}

	return Kind.METHOD;
}

function removeDecorators(member: Member, magicString: RolldownMagicString): void {
	for (const decorator of member.decorators) {
		magicString.remove(decorator.start, decorator.end);
	}
}

function hasDecorators(node: ClassNode): boolean {
	return node.decorators.length > 0 || node.body.body.some((member) => member.decorators.length > 0);
}

function analyzeProgram(program: Node): { decorated: ClassRecord[]; names: Set<string> } {
	const decorated: ClassRecord[] = [];
	const names = new Set<string>();
	const visited = new Set<object>();

	const visit = (value: unknown, parent: Node | null): void => {
		if (!value || typeof value !== "object" || visited.has(value)) {
			return;
		}

		visited.add(value);

		const node = isNode(value) ? value : null;

		if (node && (node.type === "ClassDeclaration" || node.type === "ClassExpression")) {
			if (hasDecorators(node as ClassNode)) {
				decorated.push({ node: node as ClassNode, parent });
			}
		} else if (
			node &&
			(node.type === "Identifier" || node.type === "PrivateIdentifier") &&
			typeof node.name === "string" &&
			node.name.startsWith("__decorators_")
		) {
			names.add(node.name);
		}

		for (const child of Object.values(value)) {
			if (Array.isArray(child)) {
				for (const item of child) {
					visit(item, node ?? parent);
				}
			} else {
				visit(child, node ?? parent);
			}
		}
	};

	visit(program, null);

	return { decorated, names };
}

function uniqueName(names: Set<string>, base: string): string {
	let name = base;
	while (names.has(name)) {
		name += "_";
	}
	names.add(name);

	return name;
}

function uniquePrivateName(names: Set<string>, base: string): string {
	return uniqueName(names, base.replace(/^#/, ""));
}

function createRuntimeImport(state: TransformState): string {
	const imports = [`_apply_decorators as ${state.helpers.apply}`];

	if (state.neededHelpers & Helper.CreatePrivate) {
		imports.push(`_create_private as ${state.helpers.createPrivate}`);
	}

	if (state.neededHelpers & Helper.InitClass) {
		imports.push(`_init_class as ${state.helpers.initClass}`);
	}

	if (state.neededHelpers & Helper.InitExtra) {
		imports.push(`_init_extra as ${state.helpers.initExtra}`);
	}

	if (state.neededHelpers & Helper.InitInstance) {
		imports.push(`_init_instance as ${state.helpers.initInstance}`);
	}

	if (state.neededHelpers & Helper.InitValue) {
		imports.push(`_init_value as ${state.helpers.initValue}`);
	}

	return `import{${imports.join(",")}}from${JSON.stringify(RUNTIME_ID)};`;
}

function isNode(value: unknown): value is Node {
	return Boolean(value && typeof value === "object" && typeof (value as Node).type === "string");
}

function asNode(value: unknown): Node | null {
	return isNode(value) ? value : null;
}
