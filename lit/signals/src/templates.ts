import { Signal } from "@serve-tools/signal";
import { html as litHTML, svg as litSVG, type TemplateResult } from "lit";

import { watch } from "./directives/watch.js";

const bindSignals = (values: unknown[]): void => {
	for (let index = 0; index < values.length; ++index) {
		const value = values[index];

		if (Signal.isState(value) || Signal.isComputed(value)) {
			values[index] = watch(value);
		}
	}
};

/** Creates a Lit HTML template whose direct Signal substitutions update their own parts. */
export const html = (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult<1> => {
	bindSignals(values);

	return litHTML(strings, ...values);
};

/** Creates a Lit SVG template whose direct Signal substitutions update their own parts. */
export const svg = (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult<2> => {
	bindSignals(values);

	return litSVG(strings, ...values);
};

export { type CSSResult, type CSSResultGroup, css } from "lit";
