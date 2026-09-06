export const FORM_ID = "bench-form";
export const FIELD_NAME = "choice";

export const initialChecked = (index) => index % 3 === 0;
export const controlId = (index) => `bench-checkbox-${index}`;
export const controlValue = (index) => `option-${index}`;
export const controlLabel = (index) => `Option ${index}`;

export const makeTargets = (size, count, offset) => {
	if (!Number.isInteger(size) || !Number.isInteger(count) || size < 1 || size > count) {
		throw new RangeError("Invalid target size");
	}
	if (size === count) {
		return Array.from({ length: count }, (_, index) => index);
	}
	if (size === 1) {
		return [(offset * 37) % count];
	}
	if (count !== 1000 || size !== 100) {
		throw new RangeError("Unsupported partial batch");
	}

	const start = (offset * 37) % count;
	return Array.from({ length: size }, (_, index) => (start + index * 10) % count);
};

export const expectedValues = (states) => states.flatMap((checked, index) => (checked ? [controlValue(index)] : []));

export const afterMicrotask = () => new Promise((resolve) => queueMicrotask(resolve));
