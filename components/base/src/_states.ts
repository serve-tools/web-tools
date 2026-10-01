/** Updates one custom state without changing the other states owned by the element. */
export const setCustomState = (internals: ElementInternals, state: string, present: boolean): void => {
	if (present) {
		internals.states.add(state);
	} else {
		internals.states.delete(state);
	}
};
