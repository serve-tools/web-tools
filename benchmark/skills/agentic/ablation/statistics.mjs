/** Invert exhaustive sign-flip tests across independent family-level paired contrasts. */
export function signFlipInterval(values, { minimum = -1, maximum = 1, step = 0.002 } = {}) {
	const mean = average(values);
	const variance =
		values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0;
	if (values.length !== 12 || values.some((value) => !Number.isFinite(value)) || variance < 1e-20) {
		return {
			mean,
			interval: null,
			clusters: values.length,
			degenerate: variance < 1e-20,
			reason: "Inference requires twelve nondegenerate family contrasts.",
		};
	}
	const permutations = Array.from({ length: 2 ** values.length }, (_, mask) => {
		let signed = 0;
		let signs = 0;
		for (const [index, value] of values.entries()) {
			const sign = mask & (1 << index) ? 1 : -1;
			signed += sign * value;
			signs += sign;
		}
		return [signed / values.length, signs / values.length];
	});
	const pValue = (nullValue) => {
		const observed = Math.abs(mean - nullValue);
		let extreme = 0;
		for (const [signed, signs] of permutations) {
			if (Math.abs(signed - nullValue * signs) >= observed - 1e-12) {
				++extreme;
			}
		}
		return extreme / permutations.length;
	};
	const accepted = [];
	const steps = Math.round((maximum - minimum) / step);
	for (let index = 0; index <= steps; ++index) {
		const candidate = minimum + index * step;
		if (pValue(candidate) >= 0.05) {
			accepted.push(candidate);
		}
	}
	accepted.push(mean);
	const lower = Math.min(...accepted);
	const upper = Math.max(...accepted);
	return {
		mean,
		interval:
			lower <= minimum || upper >= maximum
				? null
				: [Math.max(minimum, lower - step), Math.min(maximum, upper + step)],
		clusters: values.length,
		degenerate: false,
		pAtZero: pValue(0),
		gridStep: step,
		permutations: permutations.length,
		studentT95: [
			mean - 2.201 * Math.sqrt(variance / values.length),
			mean + 2.201 * Math.sqrt(variance / values.length),
		],
		assumption:
			"For each tested common location, family-level paired-contrast residuals are symmetric under sign changes; the interval is the conservative hull of accepted grid points, expanded one grid step.",
	};
}

export function average(values) {
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function relativeInterval(logRatios) {
	const result = signFlipInterval(logRatios, { minimum: -3, maximum: 3, step: 0.005 });
	return {
		...result,
		mean: result.mean === null ? null : Math.exp(result.mean) - 1,
		interval: result.interval?.map((value) => Math.exp(value) - 1) ?? null,
		studentT95: result.studentT95?.map((value) => Math.exp(value) - 1) ?? null,
	};
}
