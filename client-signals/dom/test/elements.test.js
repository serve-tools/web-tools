import * as assert from "node:assert/strict";
import { it } from "node:test";

class TestParent {
	children = [];
	ownerDocument;

	constructor(ownerDocument) {
		this.ownerDocument = ownerDocument;
	}

	appendChild(node) {
		this.children.push(node);
	}
}

const createTestDocument = (id) => {
	const ownerDocument = {
		createElement: (name) => ({ name, ownerDocument }),
		createElementNS: (namespace, name) => ({ name, namespace, ownerDocument }),
		id,
	};

	return ownerDocument;
};

const primaryDocument = createTestDocument("primary");

globalThis.document = primaryDocument;

const { html, mathml, svg } = await import("@serve-tools/signal-dom");

it("creates, configures, appends, and returns each element kind", () => {
	const parent = new TestParent();
	const templates = [
		[html("div", (element) => (element.configured = true)), undefined],
		[mathml("math", (element) => (element.configured = true)), "http://www.w3.org/1998/Math/MathML"],
		[svg("svg", (element) => (element.configured = true)), "http://www.w3.org/2000/svg"],
	];

	for (const [template, namespace] of templates) {
		const element = template(parent);

		assert.equal(element.configured, true);
		assert.equal(element.namespace, namespace);
		assert.equal(parent.children.at(-1), element);
	}
});

it("establishes the target document during construction and restores it after errors", () => {
	const foreignDocument = createTestDocument("foreign");
	const createElement = foreignDocument.createElement;
	const parent = new TestParent(foreignDocument);
	let constructedChild;
	let configuredChild;
	let appendedChild;

	foreignDocument.createElement = (name) => {
		if (name === "x-host") {
			constructedChild = html("span")();
		} else if (name === "x-throw") {
			throw new Error("construction failed");
		}

		return createElement(name);
	};

	parent.appendChild = (node) => {
		appendedChild = html("strong")();
		parent.children.push(node);
	};

	const host = html("x-host", () => {
		configuredChild = html("em")();
	})(parent);

	assert.equal(host.ownerDocument, foreignDocument);
	assert.equal(constructedChild.ownerDocument, foreignDocument);
	assert.equal(configuredChild.ownerDocument, foreignDocument);
	assert.equal(appendedChild.ownerDocument, foreignDocument);
	assert.throws(() => html("x-throw")(parent), /construction failed/);
	assert.equal(html("p")().ownerDocument, primaryDocument);

	assert.throws(
		() =>
			html("div", () => {
				throw new Error("item failed");
			})(parent),
		/item failed/,
	);
	assert.equal(html("p")().ownerDocument, primaryDocument);

	const throwingParent = new TestParent(foreignDocument);
	throwingParent.appendChild = () => {
		throw new Error("append failed");
	};

	assert.throws(() => html("div")(throwingParent), /append failed/);
	assert.equal(html("p")().ownerDocument, primaryDocument);
});
