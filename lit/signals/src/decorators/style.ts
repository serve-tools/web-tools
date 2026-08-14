import { Signal } from "@serve-tools/signal";
import type { ReactiveController, ReactiveControllerHost } from "lit";

import type { EffectCleanup, SignalWatcherApi } from "../mixins/SignalWatcher.js";

/** A static value accepted by a reactive host style declaration. */
export type StyleValue = string | number | CSSStyleValue | null | undefined;

/** A static value, Signal, or tracked callback accepted by a reactive host style declaration. */
export type StyleSource = StyleValue | Signal.Any<StyleValue> | (() => StyleValue);

/** CSS property names and values applied to a host style's `:host` rule. */
export type StyleDeclarations = Readonly<Record<string, StyleSource>>;

/** Creates an instance-owned reactive `:host` style from an auto-accessor's declarations. */
export const style = <This extends StyleHost, Declarations extends StyleDeclarations>(
	target: ClassAccessorDecoratorTarget<This, Declarations>,
	{ static: isStatic }: ClassAccessorDecoratorContext<This, Declarations>,
): ClassAccessorDecoratorResult<This, Declarations> => {
	if (isStatic) throw new TypeError("@style cannot decorate a static accessor");

	const styleOf = (instance: This) => target.get.call(instance) as unknown as HostStyle<Declarations>;

	return {
		init(declarations) {
			return new HostStyle(this, declarations) as unknown as Declarations;
		},
		get() {
			return styleOf(this).declarations;
		},
		set(declarations) {
			styleOf(this).setDeclarations(declarations);
		},
	};
};

interface StyleHost extends ReactiveControllerHost, SignalWatcherApi {
	readonly renderRoot: HTMLElement | DocumentFragment | undefined;
}

class HostStyle<Declarations extends StyleDeclarations> implements ReactiveController {
	#declarations: Declarations;
	#effects: EffectCleanup[];
	readonly #host: StyleHost;
	#rule: CSSStyleRule | undefined;
	#sheet: CSSStyleSheet | undefined;
	#sources: ReadonlyArray<readonly [name: string, source: StyleSource]>;

	constructor(host: StyleHost, declarations: Declarations) {
		this.#declarations = declarations;
		this.#effects = [];
		this.#host = host;
		this.#sources = Object.entries(declarations);

		try {
			this.#effects = this.#createEffects(this.#sources);
			host.addController(this);
		} catch (error) {
			host.removeController(this);
			this.#disposeEffects(this.#effects);

			throw error;
		}
	}

	get declarations(): Declarations {
		return this.#declarations;
	}

	setDeclarations(declarations: Declarations): void {
		if (declarations === this.#declarations) return;

		const sources = Object.entries(declarations);
		const values = this.#rule === undefined ? undefined : readSources(sources);
		const effects = this.#createEffects(sources);
		const previousEffects = this.#effects;

		this.#declarations = declarations;
		this.#effects = effects;
		this.#sources = sources;

		this.#disposeEffects(previousEffects);

		if (values !== undefined) {
			this.#rule!.style.cssText = "";
			this.#setProperties(values);
		}
	}

	hostConnected(): void {
		const root = this.#host.renderRoot;

		if (!isStyleSheetRoot(root)) {
			throw new TypeError("@style requires a render root with adoptedStyleSheets support");
		}

		const sheet = this.#getSheet();

		if (!root.adoptedStyleSheets.includes(sheet)) {
			root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
		}
	}

	#createEffects(sources: ReadonlyArray<readonly [name: string, source: StyleSource]>): EffectCleanup[] {
		const effects: EffectCleanup[] = [];

		try {
			for (const [name, source] of sources) {
				if (isReactiveSource(source)) {
					effects.push(
						this.#host.updateEffect(() => this.#setProperty(name, readSource(source)), {
							phase: "before-update",
						}),
					);
				}
			}
		} catch (error) {
			this.#disposeEffects(effects);

			throw error;
		}

		return effects;
	}

	#disposeEffects(effects: EffectCleanup[]): void {
		for (const dispose of effects) dispose();

		effects.length = 0;
	}

	#getSheet(): CSSStyleSheet {
		if (this.#sheet === undefined) {
			if (typeof CSSStyleSheet === "undefined") {
				throw new TypeError("@style requires constructable CSSStyleSheet support");
			}

			const values = readSources(this.#sources);
			const sheet = new CSSStyleSheet();

			sheet.replaceSync(":host {}");

			this.#sheet = sheet;
			this.#rule = sheet.cssRules[0] as CSSStyleRule;
			this.#setProperties(values);
		}

		return this.#sheet;
	}

	#setProperties(values: ReadonlyArray<readonly [name: string, value: StyleValue]>): void {
		for (const [name, value] of values) this.#setProperty(name, value);
	}

	#setProperty(name: string, value: StyleValue): void {
		const style = this.#rule?.style;

		if (style === undefined) return;

		if (value === null || value === undefined) {
			style.removeProperty(name);
		} else {
			style.setProperty(name, String(value));
		}
	}
}

// #region Types

export namespace style {
	/** CSS property names and values applied to a host style's `:host` rule. */
	export type Declarations = StyleDeclarations;

	/** A static value, Signal, or tracked callback accepted by a reactive host style declaration. */
	export type Source = StyleSource;

	/** A static value accepted by a reactive host style declaration. */
	export type Value = StyleValue;
}

// #endregion Types

// #region Helpers

const isReactiveSource = (source: StyleSource): source is Signal.Any<StyleValue> | (() => StyleValue) =>
	typeof source === "function" || Signal.isState(source) || Signal.isComputed(source);

const readSource = (source: StyleSource): StyleValue => {
	if (typeof source === "function") return source();
	if (Signal.isState(source) || Signal.isComputed(source)) return source.get() as StyleValue;

	return source;
};

const readSources = (
	sources: ReadonlyArray<readonly [name: string, source: StyleSource]>,
): ReadonlyArray<readonly [name: string, value: StyleValue]> =>
	sources.map(([name, source]) => [name, Signal.subtle.untrack(() => readSource(source))]);

const isStyleSheetRoot = (
	root: StyleHost["renderRoot"],
): root is DocumentFragment & { adoptedStyleSheets: CSSStyleSheet[] } =>
	root !== undefined && "adoptedStyleSheets" in root;

// #endregion Helpers
