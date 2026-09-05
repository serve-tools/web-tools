import { afterEach, expect, test, vi } from "vitest";
import { DisposableElement } from "../../src/lib/DisposableElement.js";

const fixtures: Element[] = [];

afterEach(() => {
	vi.restoreAllMocks();

	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
});

const create = <T extends DisposableElement>(constructor: new () => T): T => {
	const name = `aui-disposable-${crypto.randomUUID()}`;
	customElements.define(name, constructor);
	const element = document.createElement(name) as T;
	fixtures.push(element);
	return element;
};

test("reconnect creates a fresh signal", () => {
	const signals: AbortSignal[] = [];
	const cleanups: number[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					signals.push(host.disconnectedSignal());
					return () => {
						cleanups.push(1);
					};
				},
			];
		},
	);

	document.body.append(element);
	const first = signals[0]!;
	element.remove();
	expect(first.aborted).toBe(true);
	expect(cleanups).toEqual([1]);

	document.body.append(element);
	expect(signals).toHaveLength(2);
	expect(signals[1]).not.toBe(first);
	expect(signals[1]!.aborted).toBe(false);
});

test("signals created before and during connection stay live until disconnection", () => {
	const signals: AbortSignal[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					signals.push(host.disconnectedSignal());
				},
			];
		},
	);
	const detachedSignal = element.disconnectedSignal();

	expect(detachedSignal.aborted).toBe(false);
	document.body.append(element);
	expect(signals).toHaveLength(1);
	expect(signals[0]).not.toBe(detachedSignal);
	expect(signals[0]!.aborted).toBe(false);
	expect(detachedSignal.aborted).toBe(false);

	element.remove();
	expect(detachedSignal.aborted).toBe(true);
	expect(signals[0]!.aborted).toBe(true);
});

test("Symbol.dispose aborts before LIFO cleanup and is idempotent", () => {
	expect(typeof Symbol.dispose).toBe("symbol");

	const order: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					host.disconnectedSignal().addEventListener("abort", () => {
						order.push("abort");
						host[Symbol.dispose]();
					});
					return () => order.push("first cleanup");
				},
				() => () => order.push("second cleanup"),
			];
		},
	);

	document.body.append(element);
	element[Symbol.dispose]();
	element[Symbol.dispose]();
	expect(order).toEqual(["abort", "second cleanup", "first cleanup"]);
});

test("a throwing cleanup does not prevent a later connection", () => {
	const failure = new Error("cleanup failed");
	let connections = 0;
	const cleanups: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => () => {
					cleanups.push("first");
				},
				() => () => {
					cleanups.push("throwing");
					if (connections === 1) {
						throw failure;
					}
				},
				() => {
					++connections;
					return () => {
						cleanups.push("last");
					};
				},
			];
		},
	);

	document.body.append(element);
	expect(() => element[Symbol.dispose]()).toThrow(failure);
	expect(cleanups).toEqual(["last", "throwing", "first"]);
	element.remove();
	document.body.append(element);
	expect(connections).toBe(2);
});

test("cleanup drains all callbacks and chains failures in reverse cleanup order", () => {
	const first = new Error("first cleanup failed");
	const second = new Error("second cleanup failed");
	const cleanups: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => () => {
					cleanups.push("first");
					throw first;
				},
				() => () => {
					cleanups.push("second");
					throw second;
				},
				() => () => {
					cleanups.push("third");
				},
			];
		},
	);

	document.body.append(element);
	try {
		element[Symbol.dispose]();
		expect.unreachable("disposing should throw chained cleanup failures");
	} catch (error) {
		expect(error).toBeInstanceOf(SuppressedError);
		expect((error as SuppressedError).error).toBe(first);
		expect((error as SuppressedError).suppressed).toBe(second);
	}
	expect(cleanups).toEqual(["third", "second", "first"]);
});

test("a factory that removes its host runs its late cleanup and skips later factories", () => {
	const cleanups: number[] = [];
	let laterFactories = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					host.remove();
					return () => {
						cleanups.push(1);
					};
				},
				() => {
					++laterFactories;
				},
			];
		},
	);

	document.body.append(element);
	expect(cleanups).toEqual([1]);
	expect(laterFactories).toBe(0);
});

test("a throwing late cleanup is reported unchanged and later factories stay skipped", () => {
	const failure = new Error("late cleanup failed");
	const reported = vi.spyOn(globalThis, "reportError").mockImplementation(() => {});
	const order: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					host.remove();
					return () => {
						order.push("late cleanup");
						throw failure;
					};
				},
				() => {
					order.push("later factory");
				},
			];
		},
	);

	document.body.append(element);
	expect(reported).toHaveBeenCalledExactlyOnceWith(failure);
	expect(order).toEqual(["late cleanup"]);
	expect(element.isConnected).toBe(false);
});

test("a cleanup can synchronously reappend its host with a fresh active signal", () => {
	const signals: AbortSignal[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					signals.push(host.disconnectedSignal());
					return () => {
						if (signals.length === 1) {
							document.body.append(host);
						}
					};
				},
			];
		},
	);

	document.body.append(element);
	const first = signals[0]!;
	element.remove();
	const second = signals[1]!;
	expect(element.isConnected).toBe(true);
	expect(first.aborted).toBe(true);
	expect(second).not.toBe(first);
	expect(second.aborted).toBe(false);
	element.remove();
	expect(second.aborted).toBe(true);
});

test("explicit disposal honors a reconnection event raised during cleanup", () => {
	let connections = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					++connections;

					return () => {
						if (connections === 1) {
							host.remove();
							document.body.append(host);
						}
					};
				},
			];
		},
	);

	document.body.append(element);
	element.dispose();
	expect(element.isConnected).toBe(true);
	expect(connections).toBe(2);
});

test("a reentrant connection drains its old scope before starting the fresh one", () => {
	const order: string[] = [];
	let connections = 0;
	let events = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					++connections;
					order.push(`setup ${connections}`);
					if (connections === 1) {
						host.remove();
						document.body.append(host);
						return () => {
							order.push("old cleanup");
						};
					}

					host.ownerDocument.addEventListener(
						"aui-disposable-reentrant",
						() => {
							++events;
						},
						{ signal: host.disconnectedSignal() },
					);
					return () => {
						order.push("fresh cleanup");
					};
				},
				() => {
					order.push("later factory");
				},
			];
		},
	);

	document.body.append(element);
	expect(order).toEqual(["setup 1", "old cleanup", "setup 2", "later factory"]);
	document.dispatchEvent(new Event("aui-disposable-reentrant"));
	expect(events).toBe(1);
	element[Symbol.dispose]();
	expect(order).toEqual(["setup 1", "old cleanup", "setup 2", "later factory", "fresh cleanup"]);
	document.dispatchEvent(new Event("aui-disposable-reentrant"));
	expect(events).toBe(1);
});

test("old cleanup cannot remove a deduplicated listener from a reentrant connection", () => {
	let connections = 0;
	let events = 0;
	const listener = () => ++events;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					++connections;
					host.ownerDocument.addEventListener("aui-disposable-stable-listener", listener);

					return () => host.ownerDocument.removeEventListener("aui-disposable-stable-listener", listener);
				},
				(host) => () => {
					if (connections === 1) {
						document.body.append(host);
					}
				},
			];
		},
	);

	document.body.append(element);
	element.remove();
	document.dispatchEvent(new Event("aui-disposable-stable-listener"));
	expect(element.isConnected).toBe(true);
	expect(connections).toBe(2);
	expect(events).toBe(1);

	element.remove();
	document.dispatchEvent(new Event("aui-disposable-stable-listener"));
	expect(events).toBe(1);
});

test("repeated reentrant connection fails closed without recursive retries", () => {
	const reported = vi.spyOn(globalThis, "reportError").mockImplementation(() => {});
	let connections = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					++connections;
					host.remove();
					document.body.append(host);
				},
			];
		},
	);

	document.body.append(element);
	expect(element.isConnected).toBe(true);
	expect(connections).toBe(2);
	expect(reported).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({ message: "DisposableElement connectivity repeatedly changed during activation" }),
	);
});

test("direct cross-document insertion recreates document-owned resources", () => {
	const received: Document[] = [];
	const target = document.implementation.createHTMLDocument("target");
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					const owner = host.ownerDocument;
					owner.addEventListener("aui-disposable-adoption", () => received.push(owner), {
						signal: host.disconnectedSignal(),
					});
				},
			];
		},
	);

	document.body.append(element);
	target.body.append(element);
	document.dispatchEvent(new Event("aui-disposable-adoption"));
	target.dispatchEvent(new Event("aui-disposable-adoption"));
	expect(element.ownerDocument).toBe(target);
	expect(received).toEqual([target]);
});

test("a same-document connected move preserves its resource", () => {
	const containers = [document.createElement("div"), document.createElement("div")];
	fixtures.push(...containers);
	document.body.append(...containers);
	let connections = 0;
	let cleanups = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => {
					++connections;
					return () => {
						++cleanups;
					};
				},
			];
		},
	);

	containers[0].append(element);
	containers[1].append(element);
	expect(connections).toBe(1);
	expect(cleanups).toBe(0);
});

test("factory failures are reported unchanged and do not stop later factories", () => {
	const primitive = "factory failed";
	const frozen = Object.freeze({ reason: "frozen" });
	const error = new Error("error failed");
	const stack = error.stack;
	const reported = vi.spyOn(globalThis, "reportError").mockImplementation(() => {});
	let completed = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => {
					throw primitive;
				},
				() => {
					throw frozen;
				},
				() => {
					throw error;
				},
				() => {
					++completed;
				},
			];
		},
	);

	document.body.append(element);
	expect(reported).toHaveBeenNthCalledWith(1, primitive);
	expect(reported).toHaveBeenNthCalledWith(2, frozen);
	expect(reported).toHaveBeenNthCalledWith(3, error);
	expect(error.stack).toBe(stack);
	expect(completed).toBe(1);
});

test("signals without factories abort independently and renew after reconnection", () => {
	const element = create(class extends DisposableElement {});
	const first = element.disconnectedSignal();
	const second = element.disconnectedSignal();

	expect(first).not.toBe(second);
	document.body.append(element);
	element.remove();
	expect(first.aborted).toBe(true);
	expect(second.aborted).toBe(true);

	document.body.append(element);
	const third = element.disconnectedSignal();
	expect(third.aborted).toBe(false);
	element.remove();
	expect(third.aborted).toBe(true);
});

test("dispose works while detached and without any factories", () => {
	const element = create(class extends DisposableElement {});
	const signal = element.disconnectedSignal();

	element.dispose();
	element.dispose();
	expect(signal.aborted).toBe(true);
});

test("an abort listener can reenter disposal without draining a fresh scope", () => {
	let setups = 0;
	let cleanups = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables = [
				() => {
					++setups;
					return () => {
						++cleanups;
					};
				},
			];
		},
	);

	document.body.append(element);
	const oldSignal = element.disconnectedSignal();
	let newSignal: AbortSignal;
	oldSignal.addEventListener("abort", () => {
		element.dispose();
		document.body.append(element);
		newSignal = element.disconnectedSignal();
	});

	element.remove();
	expect(setups).toBe(2);
	expect(cleanups).toBe(1);
	expect(newSignal!.aborted).toBe(false);

	element.remove();
	expect(cleanups).toBe(2);
	expect(newSignal!.aborted).toBe(true);
});

test("signals requested while aborting belong to the next scope", () => {
	const element = create(class extends DisposableElement {});
	const oldSignal = element.disconnectedSignal();
	let nextSignal: AbortSignal;
	oldSignal.addEventListener("abort", () => {
		nextSignal = element.disconnectedSignal();
	});

	element.dispose();
	expect(nextSignal!.aborted).toBe(false);
	element.dispose();
	expect(nextSignal!.aborted).toBe(true);
});

test("a factory can explicitly dispose while connected and return a late cleanup", () => {
	const order: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables = [
				(host: DisposableElement) => {
					host.dispose();
					return () => {
						order.push("late cleanup");
					};
				},
				() => {
					order.push("later factory");
				},
			];
		},
	);

	document.body.append(element);
	expect(order).toEqual(["late cleanup"]);
	expect(element.isConnected).toBe(true);
});

test("multiple abort listeners precede LIFO cleanup even with nested dispose", () => {
	const order: string[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables = [
				() => () => {
					order.push("cleanup 1");
				},
				() => () => {
					order.push("cleanup 2");
				},
			];
		},
	);

	document.body.append(element);
	for (const label of ["abort 1", "abort 2"]) {
		element.disconnectedSignal().addEventListener("abort", () => {
			order.push(label);
			element.dispose();
		});
	}

	element.remove();
	expect(order).toEqual(["abort 1", "abort 2", "cleanup 2", "cleanup 1"]);
});

test("adoption without factories aborts old signals", () => {
	const element = create(class extends DisposableElement {});
	document.body.append(element);
	const signal = element.disconnectedSignal();
	const target = document.implementation.createHTMLDocument("target");

	target.body.append(element);
	expect(signal.aborted).toBe(true);
	expect(element.disconnectedSignal().aborted).toBe(false);
});

test("connection callbacks ignore detached hosts and do not initialize an active scope twice", () => {
	let connections = 0;
	let cleanups = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => {
					++connections;
					return () => {
						++cleanups;
					};
				},
			];
		},
	);

	element.connectedCallback();
	expect(connections).toBe(0);
	document.body.append(element);
	element.connectedCallback();
	element.disconnectedCallback();
	expect(connections).toBe(1);
	expect(cleanups).toBe(0);

	element.remove();
	element.disconnectedCallback();
	expect(cleanups).toBe(1);
});

test.runIf(typeof Element.prototype.moveBefore === "function")("moveBefore preserves the active scope", () => {
	const containers = [document.createElement("div"), document.createElement("div")];
	fixtures.push(...containers);
	document.body.append(...containers);
	let connections = 0;
	let cleanups = 0;
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				() => {
					++connections;
					return () => {
						++cleanups;
					};
				},
			];
		},
	);

	containers[0].append(element);
	const signal = element.disconnectedSignal();
	containers[1].moveBefore(element, null);
	expect(element.parentElement).toBe(containers[1]);
	expect(connections).toBe(1);
	expect(cleanups).toBe(0);
	expect(signal.aborted).toBe(false);

	element.remove();
	expect(cleanups).toBe(1);
	expect(signal.aborted).toBe(true);
});

test("detached adoption disposes the old scope and waits for insertion before initialization", () => {
	const documents: Document[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					documents.push(host.ownerDocument);
				},
			];
		},
	);
	const target = document.implementation.createHTMLDocument("target");
	const signal = element.disconnectedSignal();

	target.adoptNode(element);
	expect(signal.aborted).toBe(true);
	expect(element.isConnected).toBe(false);
	expect(documents).toEqual([]);

	target.body.append(element);
	expect(documents).toEqual([target]);
});

test("cross-document insertion initializes the new scope even when old cleanup throws", () => {
	const failure = new Error("old document cleanup failed");
	const failures: unknown[] = [];
	const documents: Document[] = [];
	const signals: AbortSignal[] = [];
	const element = create(
		class extends DisposableElement {
			static override readonly disposables: readonly DisposableElement.DisposableInitiator[] = [
				(host) => {
					const owner = host.ownerDocument;
					documents.push(owner);
					signals.push(host.disconnectedSignal());
					return () => {
						if (owner === document) {
							throw failure;
						}
					};
				},
			];

			override adoptedCallback(): void {
				try {
					super.adoptedCallback();
				} catch (error) {
					failures.push(error);
				}
			}
		},
	);
	const target = document.implementation.createHTMLDocument("target");

	document.body.append(element);
	target.body.append(element);
	expect(failures).toEqual([failure]);
	expect(documents).toEqual([document, target]);
	expect(signals).toHaveLength(2);
	expect(signals[0]!.aborted).toBe(true);
	expect(signals[1]!.aborted).toBe(false);

	element.remove();
	expect(signals[1]!.aborted).toBe(true);
});
