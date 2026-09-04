import { test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { Composite } from "../dist/ponyfill-composites.js";

const samples = 15;
const warmup = 5;

const options = (iterations: number) => ({ iterations, samples, warmup });

const verify: (condition: unknown, message: string) => void = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

const propertyNames = (count: number) =>
	Array.from({ length: count }, (_value, index) => `key${index.toString().padStart(2, "0")}`);

const sourceWithProperties = (names: readonly string[]): Record<string, number> => {
	const source: Record<string, number> = {};

	for (let index = 0; index < names.length; ++index) {
		const name = names[index]!;
		source[name] = Number(name.slice(3));
	}

	return source;
};

const prepopulate = (count: number): object[] => {
	const retained = new Array<object>(count);

	for (let index = 0; index < count; ++index) {
		retained[index] = Composite({ registry: "benchmark", index });
	}

	return retained;
};

test("fresh-create-hit", async () => {
	const target = Composite({ account: "acct-42", region: "us-east-1" });

	await benchmark(
		"ponyfill-composites/fresh-create-hit",
		() => {
			const result = Composite({ account: "acct-42", region: "us-east-1" });

			verify(result === target, "Expected a fresh source to return the interned composite");
			verify(Composite.isComposite(result), "Expected a composite result");
		},
		options(20_000),
	);
});

test("reordered-key-hit", async () => {
	const target = Composite({ alpha: 1, middle: 2, omega: 3 });

	await benchmark(
		"ponyfill-composites/reordered-key-hit",
		() => {
			const result = Composite({ omega: 3, middle: 2, alpha: 1 });

			verify(result === target, "Expected key order not to affect interning");
			verify(Object.keys(result).join(",") === "alpha,middle,omega", "Expected canonical key order");
		},
		options(20_000),
	);
});

for (const propertyCount of [1, 8, 32]) {
	test(`property-count-${propertyCount}-hit`, async () => {
		const names = propertyNames(propertyCount);
		const target = Composite(sourceWithProperties(names));

		await benchmark(
			`ponyfill-composites/property-count-${propertyCount}-hit`,
			() => {
				const result = Composite(sourceWithProperties(names));

				verify(result === target, "Expected matching properties to return the interned composite");
				verify(Object.keys(result).length === propertyCount, "Expected every property in the composite");
			},
			options(propertyCount === 1 ? 20_000 : propertyCount === 8 ? 10_000 : 2_500),
		);
	});
}

for (const registrySize of [8, 4_096]) {
	test(`unique-miss-registry-${registrySize}`, async () => {
		const iterations = 250;
		const retained = prepopulate(registrySize);
		const capacity = registrySize + iterations * (samples + warmup);
		retained.length = capacity;
		let next = registrySize;

		await benchmark(
			`ponyfill-composites/unique-miss-registry-${registrySize}`,
			() => {
				const result = Composite({ registry: "benchmark", index: next });

				verify(Composite.isComposite(result), "Expected a composite result");
				verify(result.index === next, "Expected the unique value to be retained");
				retained[next++] = result;
			},
			options(iterations),
		);

		verify(next === capacity, "Expected each warmup and sample operation to create one composite");
	});
}

test("negative-zero-normalization-hit", async () => {
	const target = Composite({ value: 0 });

	await benchmark(
		"ponyfill-composites/negative-zero-normalization-hit",
		() => {
			const result = Composite({ value: -0 });

			verify(result === target, "Expected default negative-zero normalization to hit zero");
			verify(Object.is(result.value, 0), "Expected canonical positive zero");
		},
		options(20_000),
	);
});

test("preserve-negative-zero-hit", async () => {
	const preserveOptions = { preserveNegativeZero: true } as const;
	const target = Composite({ value: -0 }, preserveOptions);
	const zero = Composite({ value: 0 }, preserveOptions);

	await benchmark(
		"ponyfill-composites/preserve-negative-zero-hit",
		() => {
			const result = Composite({ value: -0 }, preserveOptions);

			verify(result === target, "Expected preserved negative zero to hit its own composite");
			verify(
				result !== zero && Object.is(result.value, -0),
				"Expected negative zero to remain distinct from zero",
			);
		},
		options(20_000),
	);
});

test("nan-canonicalization-hit", async () => {
	const target = Composite({ value: Number.NaN });

	await benchmark(
		"ponyfill-composites/nan-canonicalization-hit",
		() => {
			const result = Composite({ value: Number.NaN });

			verify(result === target, "Expected NaN values to hit the canonical composite");
			verify(Number.isNaN(result.value), "Expected a NaN result value");
		},
		options(20_000),
	);
});
