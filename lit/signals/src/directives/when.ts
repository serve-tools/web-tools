import type { DirectiveResult } from "lit/directive.js";
import { directive } from "lit/directive.js";
import { ReactiveDirective, type ReactiveSource, readSource } from "./.internals.js";

class WhenDirective<Condition = unknown, TrueValue = unknown, FalseValue = undefined> extends ReactiveDirective<
	TrueValue | FalseValue | undefined
> {
	render(
		source: ReactiveSource<Condition>,
		trueCase: WhenTrueCase<Condition, TrueValue>,
		falseCase?: WhenFalseCase<Condition, FalseValue>,
	): TrueValue | FalseValue | undefined {
		const condition = readSource(source);

		return condition ? trueCase(condition as Truthy<Condition>) : falseCase?.(condition as FalsyPart<Condition>);
	}

	update(
		_part: unknown,
		args: [
			ReactiveSource<Condition>,
			WhenTrueCase<Condition, TrueValue>,
			WhenFalseCase<Condition, FalseValue> | undefined,
		],
	): TrueValue | FalseValue | undefined {
		return this.observeArguments(args, () => this.render(...args));
	}
}

/** Selects one reactive template branch and updates only its Lit part. */
export const when = directive(WhenDirective) as {
	<Condition, TrueValue, FalseValue = undefined>(
		source: ReactiveSource<Condition>,
		trueCase: WhenTrueCase<Condition, TrueValue>,
		falseCase?: WhenFalseCase<Condition, FalseValue>,
	): DirectiveResult<typeof WhenDirective<Condition, TrueValue, FalseValue>>;
};

/** A callback selected for a truthy reactive condition. */
export type WhenTrueCase<Condition, Value> = (condition: Truthy<Condition>) => Value;

/** A callback selected for a falsy reactive condition. */
export type WhenFalseCase<Condition, Value> = (condition: FalsyPart<Condition>) => Value;

type Falsy = false | 0 | -0 | 0n | "" | null | undefined;
type FalsyPart<Value> = Extract<Value, Falsy>;
type Truthy<Value> = Exclude<Value, Falsy>;
