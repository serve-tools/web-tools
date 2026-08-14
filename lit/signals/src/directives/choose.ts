import type { DirectiveResult } from "lit/directive.js";
import { directive } from "lit/directive.js";
import type { ReactiveSource } from "./.internals.js";
import { ReactiveDirective, readSource } from "./.internals.js";

class ChooseDirective<Selected = unknown, Value = unknown, DefaultValue = undefined> extends ReactiveDirective<
	Value | DefaultValue | undefined
> {
	render(
		source: ReactiveSource<Selected>,
		cases: readonly ChooseCase<Selected, Value>[],
		defaultCase?: ChooseDefaultCase<Selected, DefaultValue>,
	): Value | DefaultValue | undefined {
		const selected = readSource(source);

		for (const [caseValue, renderCase] of cases) {
			if (caseValue === selected) {
				return renderCase();
			}
		}

		return defaultCase?.(selected);
	}

	update(
		_part: unknown,
		args: [
			ReactiveSource<Selected>,
			readonly ChooseCase<Selected, Value>[],
			ChooseDefaultCase<Selected, DefaultValue> | undefined,
		],
	): Value | DefaultValue | undefined {
		return this.observeArguments(args, () => this.render(...args));
	}
}

/** Selects a reactive template case by strict equality and updates only its Lit part. */
export const choose = directive(ChooseDirective) as {
	<Selected, Value, DefaultValue = undefined>(
		source: ReactiveSource<Selected>,
		cases: readonly ChooseCase<Selected, Value>[],
		defaultCase?: ChooseDefaultCase<Selected, DefaultValue>,
	): DirectiveResult<typeof ChooseDirective<Selected, Value, DefaultValue>>;
};

/** A strict-equality value and its selected template callback. */
export type ChooseCase<Selected, Value> = readonly [value: Selected, render: () => Value];

/** A callback selected when no case matches. */
export type ChooseDefaultCase<Selected, Value> = (value: Selected) => Value;
