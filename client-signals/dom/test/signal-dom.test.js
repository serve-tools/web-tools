import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Signal } from "@serve-tools/signal";

const { attrs, createBindingScope, css, dispose, elementInternals, adoptedCSS } = await import(
	"@serve-tools/signal-dom"
);

const microtask = () => new Promise((resolve) => queueMicrotask(resolve));
const element = () => ({
	attributes: Object.create(null),
	childNodes: [],
	removeAttribute(name) {
		delete this.attributes[name];
	},
	setAttribute(name, value) {
		this.attributes[name] = String(value);
	},
});

describe("signal-dom", () => {
	it("supports static bindings", () => {
		const target = element();

		attrs({ title: "ready" })(target);

		assert.equal(target.attributes.title, "ready");
	});

	it("updates and removes reactive attributes", async () => {
		const title = new Signal.State(null);
		const target = element();

		attrs({ title })(target);

		assert.equal(target.attributes.title, undefined);

		title.set("first");
		title.set("second");

		await microtask();

		assert.equal(target.attributes.title, "second");

		title.set(null);

		await microtask();

		assert.equal(target.attributes.title, undefined);
	});

	it("captures initially dormant bindings and reconciles them on every resume", async () => {
		const title = new Signal.State("initial");
		const target = element();
		const setAttribute = target.setAttribute;
		const writes = [];
		target.setAttribute = function (name, value) {
			writes.push(String(value));
			setAttribute.call(this, name, value);
		};
		const scope = createBindingScope();

		assert.equal(
			scope.capture(() => {
				assert.equal(scope.resume(), false);

				return attrs({ title })(target);
			}),
			target,
		);
		assert.equal(target.attributes.title, "initial");
		assert.deepEqual(writes, ["initial"]);
		assert.equal(Signal.subtle.hasSinks(title), false);

		assert.equal(scope.resume(), true);
		assert.deepEqual(writes, ["initial", "initial"]);
		assert.equal(Signal.subtle.hasSinks(title), true);

		title.set("connected");
		await microtask();

		assert.equal(target.attributes.title, "connected");

		scope.suspend();
		title.set("disconnected");
		await microtask();

		assert.equal(target.attributes.title, "connected");
		assert.equal(Signal.subtle.hasSinks(title), false);
		assert.equal(scope.resume(), true);
		assert.equal(target.attributes.title, "disconnected");
		assert.equal(Signal.subtle.hasSinks(title), true);
	});

	it("does not leak captured initial reads into an enclosing computation", () => {
		const title = new Signal.State("initial");
		const target = element();
		const scope = createBindingScope();
		const outer = new Signal.Computed(() => scope.capture(() => attrs({ title })(target)));

		assert.equal(outer.get(), target);
		assert.equal(Signal.subtle.hasSources(outer), false);
		assert.equal(Signal.subtle.hasSinks(title), false);

		scope.resume();

		assert.equal(Signal.subtle.hasSinks(title), true);
	});

	it("suppresses queued writes from a suspended generation", async () => {
		const title = new Signal.State("initial");
		const target = element();
		const scope = createBindingScope();

		scope.capture(() => attrs({ title })(target));
		scope.resume();

		title.set("queued");
		scope.suspend();

		await microtask();

		assert.equal(target.attributes.title, "initial");
		assert.equal(Signal.subtle.hasSinks(title), false);

		title.set("current");

		assert.equal(scope.resume(), true);
		assert.equal(target.attributes.title, "current");

		await microtask();

		assert.equal(target.attributes.title, "current");
	});

	it("recreates exactly one subscription across repeated lifecycle transitions", () => {
		let watched = 0;
		let unwatched = 0;
		const title = new Signal.State("initial", {
			[Signal.subtle.watched]() {
				++watched;
			},
			[Signal.subtle.unwatched]() {
				++unwatched;
			},
		});
		const target = element();
		const scope = createBindingScope();

		scope.capture(() => attrs({ title })(target));

		for (let index = 0; index < 5; ++index) {
			assert.equal(scope.resume(), true);
			assert.equal(scope.resume(), true);
			scope.suspend();
			scope.suspend();
		}

		assert.equal(watched, 5);
		assert.equal(unwatched, 5);
		assert.equal(Signal.subtle.hasSinks(title), false);
	});

	it("restores nested capture ownership", () => {
		const outerFirst = new Signal.State("outer-first");
		const inner = new Signal.State("inner");
		const outerSecond = new Signal.State("outer-second");
		const outerScope = createBindingScope();
		const innerScope = createBindingScope();

		outerScope.capture(() => {
			attrs({ title: outerFirst })(element());
			innerScope.capture(() => attrs({ title: inner })(element()));
			attrs({ title: outerSecond })(element());
		});

		outerScope.resume();

		assert.equal(Signal.subtle.hasSinks(outerFirst), true);
		assert.equal(Signal.subtle.hasSinks(outerSecond), true);
		assert.equal(Signal.subtle.hasSinks(inner), false);

		innerScope.resume();
		outerScope.suspend();

		assert.equal(Signal.subtle.hasSinks(outerFirst), false);
		assert.equal(Signal.subtle.hasSinks(outerSecond), false);
		assert.equal(Signal.subtle.hasSinks(inner), true);
	});

	it("allows active capture outside setters and suspends every added binding", () => {
		const first = new Signal.State("first");
		const second = new Signal.State("second");
		const scope = createBindingScope();

		scope.capture(() => attrs({ title: first })(element()));
		scope.resume();
		scope.capture(() => attrs({ title: second })(element()));

		assert.equal(Signal.subtle.hasSinks(first), true);
		assert.equal(Signal.subtle.hasSinks(second), true);

		scope.suspend();

		assert.equal(Signal.subtle.hasSinks(first), false);
		assert.equal(Signal.subtle.hasSinks(second), false);
	});

	it("rejects capture from a resuming binding and rolls back every subscription", () => {
		const title = new Signal.State("initial");
		const nested = new Signal.State("nested");
		const target = element();
		const setAttribute = target.setAttribute;
		const scope = createBindingScope();

		target.setAttribute = function (name, value) {
			setAttribute.call(this, name, value);

			if (value === "reenter") {
				scope.capture(() => attrs({ title: nested })(element()));
			}
		};

		scope.capture(() => attrs({ title })(target));
		title.set("reenter");

		assert.throws(() => scope.resume(), /scope is running/);
		assert.equal(Signal.subtle.hasSinks(title), false);
		assert.equal(Signal.subtle.hasSinks(nested), false);

		title.set("recovered");

		assert.equal(scope.resume(), true);
		assert.equal(Signal.subtle.hasSinks(title), true);
		assert.equal(Signal.subtle.hasSinks(nested), false);
	});

	it("rejects capture from an initial scoped setter", () => {
		const title = new Signal.State("initial");
		const nested = new Signal.State("nested");
		const target = element();
		const setAttribute = target.setAttribute;
		const scope = createBindingScope();

		target.setAttribute = function (name, value) {
			setAttribute.call(this, name, value);
			scope.capture(() => attrs({ title: nested })(element()));
		};

		assert.throws(() => scope.capture(() => attrs({ title })(target)), /scope is running/);
		assert.equal(scope.resume(), true);
		assert.equal(Signal.subtle.hasSinks(title), false);
		assert.equal(Signal.subtle.hasSinks(nested), false);
	});

	it("rolls back failed and asynchronous captures without corrupting the ambient scope", () => {
		const failed = new Signal.State("failed");
		const asyncValue = new Signal.State("async");
		const retained = new Signal.State("retained");
		const scope = createBindingScope();

		assert.throws(
			() =>
				scope.capture(() => {
					attrs({ title: failed })(element());

					throw new Error("capture failed");
				}),
			/capture failed/,
		);
		assert.throws(
			() => scope.capture(() => (attrs({ title: asyncValue })(element()), Promise.resolve())),
			/capture must complete synchronously/,
		);

		scope.capture(() => attrs({ title: retained })(element()));
		scope.resume();

		assert.equal(Signal.subtle.hasSinks(failed), false);
		assert.equal(Signal.subtle.hasSinks(asyncValue), false);
		assert.equal(Signal.subtle.hasSinks(retained), true);
	});

	it("rolls back a failed resume and can retry", () => {
		const first = new Signal.State("initial-first");
		const second = new Signal.State("initial-second");
		const firstTarget = element();
		const secondTarget = element();
		const setAttribute = secondTarget.setAttribute;
		const scope = createBindingScope();

		secondTarget.setAttribute = function (name, value) {
			if (value === "fail") {
				throw new Error("resume failed");
			}

			setAttribute.call(this, name, value);
		};

		scope.capture(() => {
			attrs({ title: first })(firstTarget);
			attrs({ title: second })(secondTarget);
		});
		second.set("fail");

		assert.throws(() => scope.resume(), /resume failed/);
		assert.equal(Signal.subtle.hasSinks(first), false);
		assert.equal(Signal.subtle.hasSinks(second), false);

		second.set("recovered");

		assert.equal(scope.resume(), true);
		assert.equal(firstTarget.attributes.title, "initial-first");
		assert.equal(secondTarget.attributes.title, "recovered");
	});

	it("fails a reentrant resume closed after synchronous suspension", () => {
		const title = new Signal.State("initial");
		const target = element();
		const setAttribute = target.setAttribute;
		const scope = createBindingScope();
		let suspendOnWrite = false;

		target.setAttribute = function (name, value) {
			setAttribute.call(this, name, value);

			if (suspendOnWrite) {
				suspendOnWrite = false;
				scope.suspend();
				assert.equal(scope.resume(), false);
			}
		};

		scope.capture(() => attrs({ title })(target));
		suspendOnWrite = true;

		assert.equal(scope.resume(), false);
		assert.equal(Signal.subtle.hasSinks(title), false);
		assert.equal(scope.resume(), true);
		assert.equal(Signal.subtle.introspectSinks(title).length, 1);
	});

	it("defers resume while a queued binding setter is running", async () => {
		const title = new Signal.State("initial");
		const target = element();
		const setAttribute = target.setAttribute;
		const scope = createBindingScope();
		let resumeResult;

		target.setAttribute = function (name, value) {
			setAttribute.call(this, name, value);

			if (value === "queued") {
				resumeResult = scope.resume();
			}
		};

		scope.capture(() => attrs({ title })(target));
		scope.resume();
		title.set("queued");

		await microtask();

		assert.equal(resumeResult, false);
		assert.equal(Signal.subtle.introspectSinks(title).length, 1);
		assert.equal(scope.resume(), true);
	});

	it("terminal node disposal prevents a scoped binding from reviving", () => {
		const title = new Signal.State("initial");
		const target = element();
		const scope = createBindingScope();

		scope.capture(() => attrs({ title })(target));
		dispose(target);

		assert.equal(scope.resume(), true);
		assert.equal(Signal.subtle.hasSinks(title), false);

		title.set("after");

		assert.equal(target.attributes.title, "initial");

		scope.dispose();

		assert.equal(scope.resume(), false);
		assert.throws(() => scope.capture(() => undefined), /disposed scope/);
	});

	it("dereferences computed bindings", async () => {
		const title = new Signal.State("first");
		const computedTitle = new Signal.Computed(() => title.get().toUpperCase());
		const target = element();

		attrs({ title: computedTitle })(target);

		assert.equal(target.attributes.title, "FIRST");

		title.set("second");
		await microtask();

		assert.equal(target.attributes.title, "SECOND");
	});

	it("disposes bindings idempotently before a queued flush", async () => {
		const title = new Signal.State("before");
		const target = element();

		attrs({ title })(target);
		title.set("queued");
		dispose(target);
		dispose(target);

		await microtask();

		assert.equal(target.attributes.title, "before");

		title.set("after");
		await microtask();

		assert.equal(target.attributes.title, "before");
	});

	it("registers cleanup before an initial setter can dispose its owner", async () => {
		const title = new Signal.State("before");
		const values = [];
		const target = {
			childNodes: [],
			removeAttribute() {},
			setAttribute(_name, value) {
				values.push(value);
				dispose(this);
			},
		};

		attrs({ title })(target);
		title.set("after");
		await microtask();

		assert.deepEqual(values, ["before"]);
	});

	it("updates shared signals while disposing bindings independently", async () => {
		const title = new Signal.State("title");
		const first = element();
		const second = element();

		attrs({ title })(first);
		attrs({ title })(second);

		title.set("after");
		dispose(first);
		await microtask();

		assert.equal(first.attributes.title, "title");
		assert.equal(second.attributes.title, "after");

		dispose(second);
		title.set("final");
		await microtask();

		assert.equal(second.attributes.title, "after");
	});

	it("continues updating other signals and rearms after a binding throws", () => {
		const queued = [];
		const queueMicrotask = globalThis.queueMicrotask;
		globalThis.queueMicrotask = (callback) => queued.push(callback);
		const first = new Signal.State("first");
		const second = new Signal.State("second");
		const firstTarget = element();
		const secondTarget = element();
		let shouldThrow = false;
		firstTarget.setAttribute = function (name, value) {
			if (shouldThrow) {
				throw new Error("setter failed");
			}

			this.attributes[name] = String(value);
		};

		attrs({ title: first })(firstTarget);
		attrs({ title: second })(secondTarget);

		try {
			shouldThrow = true;
			first.set("failed");
			second.set("updated");

			assert.equal(queued.length, 1);
			assert.throws(() => queued.shift()(), /setter failed/);
			assert.equal(secondTarget.attributes.title, "updated");

			shouldThrow = false;
			first.set("recovered");
			second.set("updated again");

			assert.equal(queued.length, 1);
			queued.shift()();
			assert.equal(firstTarget.attributes.title, "recovered");
			assert.equal(secondTarget.attributes.title, "updated again");
		} finally {
			globalThis.queueMicrotask = queueMicrotask;
			dispose(firstTarget);
			dispose(secondTarget);
		}
	});

	it("isolates bindings that share a signal when one setter throws", () => {
		const queued = [];
		const queueMicrotask = globalThis.queueMicrotask;
		globalThis.queueMicrotask = (callback) => queued.push(callback);
		const title = new Signal.State("before");
		const firstTarget = element();
		const secondTarget = element();
		let shouldThrow = false;
		firstTarget.setAttribute = function (name, value) {
			if (shouldThrow) {
				throw new Error("setter failed");
			}

			this.attributes[name] = String(value);
		};

		try {
			attrs({ title })(firstTarget);
			attrs({ title })(secondTarget);

			shouldThrow = true;
			title.set("after");

			assert.equal(queued.length, 1);
			assert.throws(() => queued.shift()(), /setter failed/);
			assert.equal(secondTarget.attributes.title, "after");
		} finally {
			globalThis.queueMicrotask = queueMicrotask;
			dispose(firstTarget);
			dispose(secondTarget);
		}
	});

	it("releases a subscription when its initial setter throws", () => {
		const title = new Signal.State("title");
		const target = {
			childNodes: [],
			removeAttribute() {},
			setAttribute() {
				throw new Error("initial setter failed");
			},
		};

		assert.throws(() => attrs({ title })(target), /initial setter failed/);
		assert.equal(Signal.subtle.hasSinks(title), false);
	});

	it("updates element internals without mutating the input", async () => {
		const role = new Signal.State("button");
		const values = { role };
		const target = {};

		let attachments = 0;

		const element = {
			attachInternals() {
				++attachments;
				return target;
			},
		};

		assert.equal(elementInternals(values)(element), element);
		assert.equal(attachments, 1);
		assert.equal(target.role, "button");
		assert.equal(values.role, role);

		role.set("link");

		await microtask();

		assert.equal(target.role, "link");
	});

	it("creates and adopts a stylesheet that updates in place", async () => {
		const cssText = new Signal.State(":host { color: red; }");
		const root = { adoptedStyleSheets: [] };

		globalThis.CSSStyleSheet = class {
			replaceSync(value) {
				this.cssText = value;
			}
		};

		const sheet = css`${cssText}`;

		assert.ok(sheet instanceof CSSStyleSheet);
		assert.equal(sheet.cssText, ":host { color: red; }");
		assert.equal(adoptedCSS(sheet)(root), root);
		assert.equal(root.adoptedStyleSheets.length, 1);
		assert.equal(root.adoptedStyleSheets[0], sheet);

		cssText.set(":host { color: blue; }");

		await microtask();

		assert.equal(root.adoptedStyleSheets.length, 1);
		assert.equal(sheet.cssText, ":host { color: blue; }");

		dispose(sheet);
	});

	it("updates CSS template signal interpolations", async () => {
		const color = new Signal.State("red");
		const root = { adoptedStyleSheets: [], childNodes: [] };

		globalThis.CSSStyleSheet = class {
			replaceSync(value) {
				this.cssText = value;
			}
		};

		adoptedCSS(css`:host { color: ${color}; }`)(root);

		assert.equal(root.adoptedStyleSheets[0].cssText, ":host { color: red; }");

		color.set("blue");

		await microtask();

		assert.equal(root.adoptedStyleSheets[0].cssText, ":host { color: blue; }");

		dispose(root);

		color.set("green");

		await microtask();

		assert.equal(root.adoptedStyleSheets[0].cssText, ":host { color: blue; }");
	});
});
