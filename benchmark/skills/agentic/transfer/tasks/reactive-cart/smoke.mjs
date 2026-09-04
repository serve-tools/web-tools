import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createReactiveCart } = await loadSolution();
const publications = [];
const cart = createReactiveCart(
	[
		{ id: "b", price: 2, quantity: 3, taxed: true },
		{ id: "a", price: 1.5, quantity: 2, taxed: false },
	],
	(value) => publications.push(value),
);

assert.equal(publications.length, 1);
assert.deepEqual(cart.snapshot(), {
	lines: [
		{ id: "a", price: 1.5, quantity: 2, taxed: false, amount: 3 },
		{ id: "b", price: 2, quantity: 3, taxed: true, amount: 6 },
	],
	subtotal: 9,
	taxedSubtotal: 6,
});

cart.set("b", 2, 3, true);
cart.set("a", 2, 2, true);
cart.set("c", 4, 1, false);
assert.equal(publications.length, 1);
await flushMicrotasks();
assert.equal(publications.length, 2);
assert.equal(cart.remove("missing"), false);
assert.equal(cart.remove("b"), true);
await flushMicrotasks();
assert.deepEqual(cart.snapshot(), {
	lines: [
		{ id: "a", price: 2, quantity: 2, taxed: true, amount: 4 },
		{ id: "c", price: 4, quantity: 1, taxed: false, amount: 4 },
	],
	subtotal: 8,
	taxedSubtotal: 4,
});

assert.throws(() => cart.set("x", -1, 1, false), TypeError);
assert.throws(() => cart.remove(""), TypeError);
assert.equal(
	cart.snapshot().lines.some((line) => line.id === "x"),
	false,
);
