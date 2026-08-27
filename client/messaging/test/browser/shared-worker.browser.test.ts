/// <reference lib="dom" />

import { expect, test, vi } from "vitest";

import { protocol } from "../../src/lib/.internals.js";
import { connect, SharedWorker } from "../../src/scope/window.js";
import type { SharedCounterProtocol } from "./shared-worker.js";

const invokeLockRequest = (
	request: LockManager["request"],
	name: string,
	optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
	callback?: LockGrantedCallback<unknown>,
): Promise<unknown> =>
	callback
		? request(name, optionsOrCallback as LockOptions, callback)
		: request(name, optionsOrCallback as LockGrantedCallback<unknown>);

const expectLeaseState = async (name: string, held: boolean, pending?: boolean): Promise<void> => {
	await vi.waitFor(async () => {
		const snapshot = await navigator.locks.query();

		expect(snapshot.held?.some((lock) => lock.name === name) ?? false).toBe(held);
		if (pending !== undefined) {
			expect(snapshot.pending?.some((lock) => lock.name === name) ?? false).toBe(pending);
		}
	});
};

const open = (name: string) => {
	const worker = new SharedWorker<SharedCounterProtocol>(new URL("./shared-worker.ts", import.meta.url), {
		name,
		type: "module",
	});

	return {
		client: worker.client,
		port: worker.port,
		close(): void {
			worker.client.close();
			worker.port.close();
		},
	};
};

test("keeps a delayed liveness lease from closing either shared-worker client", async () => {
	const sharedName = crypto.randomUUID();
	const first = open(sharedName);
	const lockManager = navigator.locks;
	const request = lockManager.request.bind(lockManager);
	const blockerHeld = Promise.withResolvers<void>();
	const releaseBlocker = Promise.withResolvers<void>();
	const requestLease = Promise.withResolvers<void>();
	const leaseHeld = Promise.withResolvers<void>();
	let blockerRequest: Promise<unknown> | undefined;
	let clientLeaseRequest: Promise<unknown> | undefined;
	let delayedName: string | undefined;

	const delayedRequest = vi.spyOn(lockManager, "request").mockImplementation(((
		name: string,
		optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
		callback?: LockGrantedCallback<unknown>,
	) => {
		const invoke = (granted: LockGrantedCallback<unknown>): Promise<unknown> =>
			callback
				? invokeLockRequest(request, name, optionsOrCallback, granted)
				: invokeLockRequest(request, name, granted);

		if (!delayedName && name.startsWith(`${protocol}#`)) {
			delayedName = name;

			blockerRequest = request(name, () => {
				blockerHeld.resolve();

				return releaseBlocker.promise;
			});

			clientLeaseRequest = requestLease.promise.then(() =>
				invoke((lock) => {
					leaseHeld.resolve();

					return typeof optionsOrCallback === "function" ? optionsOrCallback(lock) : callback?.(lock);
				}),
			);

			return clientLeaseRequest;
		}

		return invoke(typeof optionsOrCallback === "function" ? optionsOrCallback : callback!);
	}) as unknown as LockManager["request"]);
	const second = open(sharedName);
	const connections = [first, second];
	const observed = [[] as number[], [] as number[]];
	let subscriptions: ReturnType<typeof first.client.subscribe>[] = [];

	try {
		await blockerHeld.promise;
		expect(delayedName).toBeDefined();
		await expect(second.client.ready).resolves.toBeUndefined();

		// The old implementation announces its lease before this request. Its response proves that the worker has
		// queued any announced lease behind our real native blocker before we release it.
		expect(await second.client.request("echo", "before lease acquisition")).toBe("before lease acquisition");

		releaseBlocker.resolve();
		requestLease.resolve();
		await leaseHeld.promise;
		delayedRequest.mockRestore();

		await expect.poll(() => first.client.request("connectionCount")).toBe(2);

		subscriptions = [
			first.client.subscribe("totals", (value) => observed[0].push(value)),
			second.client.subscribe("totals", (value) => observed[1].push(value)),
		];

		expect(
			await Promise.all([first.client.request("echo", "first"), second.client.request("echo", "second")]),
		).toEqual(["first", "second"]);

		await expect.poll(() => first.client.request("subscriberCount")).toBe(2);

		expect(await first.client.request("increment", 2)).toBe(2);
		expect(await second.client.request("increment", 3)).toBe(5);

		await expect
			.poll(() => observed)
			.toEqual([
				[0, 2, 5],
				[0, 2, 5],
			]);

		const input = new Uint8Array([4, 8, 15, 16, 23, 42]);
		const output = await first.client.request("transfer", input.buffer, { transfer: [input.buffer] });

		expect(input.byteLength).toBe(0);
		expect([...new Uint8Array(output)]).toEqual([4, 8, 15, 16, 23, 42]);

		await expect(second.client.request("fail")).rejects.toMatchObject({
			name: "TypeError",
			message: "browser failure",
		});

		const controller = new AbortController();
		const held = second.client.request("hold", undefined, { signal: controller.signal });

		controller.abort();

		await expect(held).rejects.toMatchObject({ name: "AbortError" });
		await expect.poll(() => first.client.request("cancellationCount")).toBe(1);

		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});

		await expect.poll(() => first.client.request("subscriberCount")).toBe(0);
	} finally {
		releaseBlocker.resolve();
		requestLease.resolve();
		delayedRequest.mockRestore();
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});
		connections.forEach((connection) => {
			connection.close();
		});

		await Promise.allSettled([blockerRequest, clientLeaseRequest].filter((value) => value !== undefined));

		if (delayedName) {
			await expectLeaseState(delayedName, false, false);
		}
	}
});

test("cancels a pending liveness lease when the client closes", async () => {
	const lockManager = navigator.locks;
	const request = lockManager.request.bind(lockManager);
	const blockerHeld = Promise.withResolvers<void>();
	const releaseBlocker = Promise.withResolvers<void>();
	const messages: unknown[][] = [];
	let blockerRequest: Promise<unknown> | undefined;
	let clientLeaseRequest: Promise<unknown> | undefined;
	let leaseName: string | undefined;

	const requestSpy = vi.spyOn(lockManager, "request").mockImplementation(((
		name: string,
		optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
		callback?: LockGrantedCallback<unknown>,
	) => {
		if (!leaseName && name.startsWith(`${protocol}#`)) {
			leaseName = name;
			blockerRequest = request(name, () => {
				blockerHeld.resolve();

				return releaseBlocker.promise;
			});
		}

		clientLeaseRequest = invokeLockRequest(request, name, optionsOrCallback, callback);

		return clientLeaseRequest;
	}) as unknown as LockManager["request"]);
	const client = connect({
		addEventListener: () => {},
		removeEventListener: () => {},
		postMessage: (message: unknown) => messages.push(message as unknown[]),
	});

	try {
		await blockerHeld.promise;
		expect(leaseName).toBeDefined();
		await expectLeaseState(leaseName!, true, true);

		client.close();

		await expect(clientLeaseRequest).rejects.toMatchObject({ name: "AbortError" });
		expect(messages.some((message) => message[1] === "lease")).toBe(false);
		await expectLeaseState(leaseName!, true, false);
	} finally {
		client.close();
		releaseBlocker.resolve();
		requestSpy.mockRestore();
		await Promise.allSettled([blockerRequest, clientLeaseRequest].filter((value) => value !== undefined));

		if (leaseName) {
			await expectLeaseState(leaseName, false, false);
		}
	}
});

test("cleans up a client whose liveness lease is released without a protocol close", async () => {
	const sharedName = crypto.randomUUID();
	const lockManager = navigator.locks;
	const request = lockManager.request.bind(lockManager);
	const leaseNames: string[] = [];
	const requestSpy = vi.spyOn(lockManager, "request").mockImplementation(((
		name: string,
		optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
		callback?: LockGrantedCallback<unknown>,
	) => {
		if (name.startsWith(`${protocol}#`)) {
			leaseNames.push(name);
		}

		return invokeLockRequest(request, name, optionsOrCallback, callback);
	}) as unknown as LockManager["request"]);
	const observer = open(sharedName);
	const abandoned = open(sharedName);
	const subscription = abandoned.client.subscribe("totals", () => {});

	try {
		expect(leaseNames).toHaveLength(2);
		const [observerLease, abandonedLease] = leaseNames as [string, string];

		requestSpy.mockRestore();
		await expectLeaseState(observerLease, true);
		await expectLeaseState(abandonedLease, true);
		await expect.poll(() => observer.client.request("subscriberCount")).toBe(1);

		abandoned.port.close();

		await navigator.locks.request(abandonedLease, { steal: true }, () => {});

		await expect.poll(() => observer.client.request("subscriberCount")).toBe(0);
	} finally {
		requestSpy.mockRestore();
		subscription.unsubscribe();
		abandoned.client.close();
		observer.close();

		await Promise.all(leaseNames.map((name) => expectLeaseState(name, false, false)));
	}
});
