import "@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";

const { Object, Symbol, WeakMap } = globalThis;
const { create, defineProperty, getOwnPropertyDescriptor } = Object;
const metadataSymbol = Symbol.metadata;

const KIND_NAMES = ["class", "method", "field", "accessor", "getter", "setter"];
const META = new WeakMap();
const CLASS = new WeakMap();
const identity = (value) => value;

const decorate = (decorators, value, context) => {
	for (let index = decorators.length; index--; ) {
		value = decorators[index](value, context) ?? value;
	}

	return value;
};

const runInitializers = (initializers, receiver) => {
	for (const initializer of initializers ?? []) {
		initializer.call(receiver);
	}
};

const composeInitializers = (initializers) =>
	initializers.length
		? function (value) {
				for (const initializer of initializers) {
					value = initializer.call(this, value);
				}

				return value;
			}
		: undefined;

const createPrivate = (kind, value) => {
	const values = new WeakMap();
	const controller = {
		a: {
			has: (receiver) => values.has(receiver),
			get: (receiver) => controller.g(receiver),
			set: (receiver, next) => controller.s(receiver, next),
		},
		g: (receiver) => values.get(receiver),
		s: (receiver, next) => values.set(receiver, next),
		v: () =>
			kind === 3
				? {
						get() {
							return values.get(this);
						},
						set(next) {
							values.set(this, next);
						},
					}
				: value,
		r(next) {
			if (kind === 3 && next) {
				const accessor = next;
				if (accessor.get) {
					controller.g = (receiver) => accessor.get.call(receiver);
				}
				if (accessor.set) {
					controller.s = (receiver, nextValue) => accessor.set.call(receiver, nextValue);
				}
			} else if (next) {
				value = next;
				if (kind === 1) {
					controller.g = (receiver) => value.bind(receiver);
				}
				if (kind === 4) {
					controller.g = (receiver) => value.call(receiver);
				}
				if (kind === 5) {
					controller.s = (receiver, nextValue) => value.call(receiver, nextValue);
				}
			}
		},
	};

	controller.r(value);

	return controller;
};

const bucketOf = ([, kind, , isStatic]) => {
	if (kind === 0) {
		return 4;
	}
	if (kind === 2) {
		return isStatic ? 2 : 3;
	}

	return isStatic ? 0 : 1;
};

const applyDecorators = (Class, ...entries) => {
	const instanceInitializers = [];
	const staticInitializers = [];
	const classInitializers = [];
	const instanceValues = new Map();
	const staticValues = new Map();
	const metadata = create(Class[metadataSymbol] ?? null);
	let Replacement = Class;

	entries = entries.map((entry, index) => [entry, index]);
	entries.sort(
		([left, leftIndex], [right, rightIndex]) => bucketOf(left) - bucketOf(right) || leftIndex - rightIndex,
	);

	for (const [[decorators, kind, name, isStatic, isPrivate, controller]] of entries) {
		if (kind === 0) {
			Replacement = decorate(decorators, Replacement, {
				kind: KIND_NAMES[kind],
				name,
				metadata,
				addInitializer: (initializer) => classInitializers.push(initializer),
			});
			continue;
		}

		const target = isStatic ? Replacement : Replacement.prototype;
		const extraInitializers = kind === 2 || kind === 3 ? [] : undefined;
		let descriptor = getOwnPropertyDescriptor(target, name);
		let value = controller
			? controller.v()
			: kind === 1
				? descriptor?.value
				: kind === 3
					? { get: descriptor?.get, set: descriptor?.set }
					: kind === 4
						? descriptor?.get
						: kind === 5
							? descriptor?.set
							: undefined;

		const context = {
			kind: KIND_NAMES[kind],
			name,
			static: Boolean(isStatic),
			private: Boolean(isPrivate),
			metadata,
			access: controller?.a ?? {
				has: (receiver) => name in receiver,
				get: (receiver) => (descriptor?.get ? descriptor.get.call(receiver) : receiver[name]),
				set: (receiver, next) =>
					descriptor?.set ? descriptor.set.call(receiver, next) : void (receiver[name] = next),
			},
			addInitializer: (initializer) => {
				(extraInitializers ?? (isStatic ? staticInitializers : instanceInitializers)).push(initializer);
			},
		};

		if (kind === 2) {
			const initializers = [];
			for (let index = decorators.length; index--; ) {
				const initializer = decorators[index](undefined, context);
				if (initializer !== undefined) {
					initializers.push(initializer);
				}
			}
			value = composeInitializers(initializers);
		} else if (kind === 3) {
			const initializers = [];
			for (let index = decorators.length; index--; ) {
				const current = { get: value.get, set: value.set };
				const replacement = decorators[index](current, context);
				value = {
					get: replacement?.get ?? current.get,
					set: replacement?.set ?? current.set,
				};
				if (replacement?.init) {
					initializers.push(replacement.init);
				}
			}
			value.init = composeInitializers(initializers);
		} else {
			value = decorate(decorators, value, context);
		}

		if (kind === 2 || kind === 3) {
			const accessor = value ?? {};
			const state =
				kind === 2
					? { initializer: value, setter: controller?.s, extraInitializers }
					: { initializer: accessor.init, setter: controller?.s, extraInitializers };

			(isStatic ? staticValues : instanceValues).set(controller ?? name, state);
		}

		if (kind === 2) {
			continue;
		}
		if (controller) {
			controller.r(value);
		} else if (kind === 1) {
			defineProperty(target, name, { value, writable: true, configurable: true });
		} else {
			descriptor ??= {};
			if (kind === 3) {
				if (value?.get) {
					descriptor.get = value.get;
				}
				if (value?.set) {
					descriptor.set = value.set;
				}
			} else if (kind === 4) {
				descriptor.get = value;
			} else {
				descriptor.set = value;
			}
			descriptor.configurable = true;
			defineProperty(target, name, descriptor);
		}
	}

	defineProperty(Replacement, metadataSymbol, { configurable: true, value: metadata });
	runInitializers(staticInitializers, Replacement);

	META.set(Replacement, { instanceInitializers, instanceValues, staticValues });

	if (Replacement !== Class || classInitializers.length) {
		CLASS.set(Class, [Replacement, classInitializers]);
	}

	return Replacement;
};

const initClass = (Class) => {
	const result = CLASS.get(Class);

	if (!result) {
		return Class;
	}

	runInitializers(result[1], result[0]);

	return result[0];
};

const initInstance = (receiver, owner) => {
	runInitializers(META.get(owner)?.instanceInitializers, receiver);
};

const initValue = (receiver, key, value, owner, isStatic = false) => {
	const state = META.get(owner)?.[isStatic ? "staticValues" : "instanceValues"].get(key);
	const next = (state?.initializer ?? identity).call(receiver, value);

	if (state?.setter) {
		state.setter(receiver, next);

		runInitializers(state.extraInitializers, receiver);
	}

	return next;
};

const initExtra = (receiver, key, owner, isStatic = false) => {
	const state = META.get(owner)?.[isStatic ? "staticValues" : "instanceValues"].get(key);

	runInitializers(state?.extraInitializers, receiver);
};

export {
	applyDecorators as _apply_decorators,
	createPrivate as _create_private,
	initClass as _init_class,
	initExtra as _init_extra,
	initInstance as _init_instance,
	initValue as _init_value,
};
