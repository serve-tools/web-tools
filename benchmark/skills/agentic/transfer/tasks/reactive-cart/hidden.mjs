import { assert, flushMicrotasks, loadSolution } from "../_shared.mjs";

const { createReactiveCart } = await loadSolution();

assert.throws(() => createReactiveCart(null, () => {}), TypeError);
assert.throws(() => createReactiveCart([], null), TypeError);

const sparse = new Array(2);
sparse[1] = { id: "a", price: 1, quantity: 1, taxed: false };
assert.throws(() => createReactiveCart(sparse, () => {}), TypeError);
for (const record of [
	{ id: "", price: 1, quantity: 1, taxed: false },
	{ id: "x", price: Number.NaN, quantity: 1, taxed: false },
	{ id: "x", price: 1, quantity: -1, taxed: false },
	{ id: "x", price: 1, quantity: 1.5, taxed: false },
	{ id: "x", price: 1, quantity: 1, taxed: null },
]) {
	assert.throws(() => createReactiveCart([record], () => {}), TypeError);
}

const initial = { id: "same", price: 1, quantity: 1, taxed: false };
const publications = [];
const cart = createReactiveCart([initial, { id: "same", price: 3, quantity: 2, taxed: true }], (value) =>
	publications.push(value),
);
initial.price = 99;
assert.equal(cart.snapshot().subtotal, 6);
publications[0].lines[0].price = 1000;
publications[0].lines.push({ id: "injected", price: 1, quantity: 1, taxed: true, amount: 1 });
publications[0].subtotal = -1;
assert.equal(cart.snapshot().subtotal, 6);
assert.equal(
	cart.snapshot().lines.some((line) => line.id === "injected"),
	false,
);

const publishedLine = publications[0].lines[0];
publishedLine.quantity = 99;
assert.equal(cart.snapshot().lines[0].quantity, 2);

let expectedSubtotal = 6;
let expectedTaxed = 6;
for (let index = 0; index < 20; ++index) {
	const id = `i${String(index).padStart(2, "0")}`;
	const price = (index + 1) / 4;
	const quantity = index % 5;
	const taxed = index % 3 === 0;
	const amount = price * quantity;

	cart.set(id, price, quantity, taxed);
	expectedSubtotal += amount;
	if (taxed) {
		expectedTaxed += amount;
	}
}
await flushMicrotasks();
assert.equal(publications.length, 2);
assert.equal(cart.snapshot().subtotal, expectedSubtotal);
assert.equal(cart.snapshot().taxedSubtotal, expectedTaxed);
assert.deepEqual(
	cart.snapshot().lines.map((line) => line.id),
	[...cart.snapshot().lines.map((line) => line.id)].sort(),
);

const beforeTaxToggle = publications.length;
const i01 = cart.snapshot().lines.find((line) => line.id === "i01");
cart.set(i01.id, i01.price, i01.quantity, true);
await flushMicrotasks();
assert.equal(publications.length, beforeTaxToggle + 1);
assert.equal(cart.snapshot().taxedSubtotal, expectedTaxed + i01.amount);
expectedTaxed += i01.amount;

const preserved = publications.at(-1);
const publishedBeforeDispose = publications.length;
cart.set("i00", 100, 1, false);
cart.dispose();
cart.dispose();
await flushMicrotasks();
assert.equal(publications.length, publishedBeforeDispose);
assert.notEqual(cart.snapshot().subtotal, expectedSubtotal);
assert.equal(preserved.subtotal, expectedSubtotal);
assert.notEqual(preserved.lines, cart.snapshot().lines);

const before = cart.snapshot();
for (const arguments_ of [
	[1, 1, 1, false],
	["bad", 1, 1, null],
	["bad", 1, Number.MAX_SAFE_INTEGER + 1, false],
	["bad", Number.POSITIVE_INFINITY, 1, false],
]) {
	assert.throws(() => cart.set(...arguments_), TypeError);
}
assert.deepEqual(cart.snapshot(), before);
