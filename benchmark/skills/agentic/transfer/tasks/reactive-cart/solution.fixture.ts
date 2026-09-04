import { SignalMap, SignalSet } from "@serve-tools/signal-collections";
import { effect } from "@serve-tools/signal-effect";

interface CartInput {
	readonly id: string;
	readonly price: number;
	readonly quantity: number;
	readonly taxed: boolean;
}

interface StoredLine {
	readonly price: number;
	readonly quantity: number;
}

export function createReactiveCart(initial: Iterable<CartInput>, publish: (value: unknown) => void) {
	if (typeof publish !== "function") {
		throw new TypeError("Expected publish callback");
	}

	const records = copyRecords(initial);
	const lines = new SignalMap<string, StoredLine>();
	const taxed = new SignalSet<string>();

	for (const record of records) {
		lines.set(record.id, { price: record.price, quantity: record.quantity });
		if (record.taxed) {
			taxed.add(record.id);
		} else {
			taxed.delete(record.id);
		}
	}

	const snapshot = () => {
		let subtotal = 0;
		let taxedSubtotal = 0;
		const output = Array.from(lines, ([id, line]) => {
			const amount = line.price * line.quantity;
			const isTaxed = taxed.has(id);

			subtotal += amount;
			if (isTaxed) {
				taxedSubtotal += amount;
			}

			return { id, price: line.price, quantity: line.quantity, taxed: isTaxed, amount };
		}).sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

		return { lines: output, subtotal, taxedSubtotal };
	};
	const stop = effect(() => publish(snapshot()));

	return {
		set(id: string, price: number, quantity: number, isTaxed: boolean): void {
			validateRecord({ id, price, quantity, taxed: isTaxed });

			const current = lines.get(id);

			if (
				current &&
				Object.is(current.price, price) &&
				current.quantity === quantity &&
				taxed.has(id) === isTaxed
			) {
				return;
			}

			lines.set(id, { price, quantity });
			if (isTaxed) {
				taxed.add(id);
			} else {
				taxed.delete(id);
			}
		},
		remove(id: string): boolean {
			if (typeof id !== "string" || id.length === 0) {
				throw new TypeError("Invalid id");
			}

			const removed = lines.delete(id);

			if (removed) {
				taxed.delete(id);
			}

			return removed;
		},
		snapshot,
		dispose: stop,
	};
}

function copyRecords(value: Iterable<CartInput>): CartInput[] {
	if (value == null || typeof value[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable records");
	}

	return Array.from(value, (record) => {
		validateRecord(record);

		return { id: record.id, price: record.price, quantity: record.quantity, taxed: record.taxed };
	});
}

function validateRecord(value: unknown): asserts value is CartInput {
	if (
		typeof value !== "object" ||
		value === null ||
		Array.isArray(value) ||
		typeof (value as CartInput).id !== "string" ||
		(value as CartInput).id.length === 0 ||
		typeof (value as CartInput).price !== "number" ||
		!Number.isFinite((value as CartInput).price) ||
		(value as CartInput).price < 0 ||
		!Number.isSafeInteger((value as CartInput).quantity) ||
		(value as CartInput).quantity < 0 ||
		typeof (value as CartInput).taxed !== "boolean"
	) {
		throw new TypeError("Invalid cart record");
	}
}
