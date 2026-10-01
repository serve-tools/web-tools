export const noAnimationStyle = { animation: "none", transition: "none" };

export const afterMicrotask = () => new Promise((resolve) => queueMicrotask(resolve));

export const afterRenderOpportunity = () => new Promise((resolve) => requestAnimationFrame(resolve));

export const measure = async (operation, cleanup = () => {}) => {
	const start = performance.now();
	try {
		await operation();
	} catch (error) {
		cleanup();
		throw error;
	}
	const durationMs = performance.now() - start;
	const renderOpportunity = afterRenderOpportunity();
	cleanup();
	await renderOpportunity;
	const renderOpportunityDurationMs = performance.now() - start;
	return {
		durationMs,
		perOperationMs: durationMs,
		renderOpportunityDurationMs,
		renderOpportunityPerOperationMs: renderOpportunityDurationMs,
		repetitions: 1,
	};
};

export const prepareStateWait = (targets, matches, observerOptions = { attributes: true }) => {
	let active = false;
	let resolveFinished;
	let settlementError;
	let settled = false;
	const finished = new Promise((resolve) => {
		resolveFinished = resolve;
	});
	const finish = (error) => {
		if (settled) {
			return;
		}
		settled = true;
		settlementError = error;
		resolveFinished();
	};
	const check = () => {
		if (!active) {
			return;
		}
		try {
			if (matches()) {
				finish();
			}
		} catch (error) {
			finish(error);
		}
	};
	const observer = new MutationObserver(check);
	for (const target of targets) {
		observer.observe(target, observerOptions);
	}
	document.addEventListener("focusin", check);
	const timeoutId = setTimeout(() => finish(new Error("Timed out waiting for final DOM state")), 2_000);
	let cleaned = false;
	const cleanup = () => {
		if (cleaned) {
			return;
		}
		cleaned = true;
		clearTimeout(timeoutId);
		observer.disconnect();
		document.removeEventListener("focusin", check);
		finish();
	};

	return {
		cleanup,
		async run(mutate) {
			active = true;
			try {
				await mutate();
				check();
				await finished;
				if (settlementError) {
					throw settlementError;
				}
				if (!matches()) {
					throw new Error("DOM state left its expected final value after settlement");
				}
			} catch (error) {
				cleanup();
				throw error;
			}
		},
	};
};

export const prepareAttributeWait = (expectations, additionalMatch = () => true) =>
	prepareStateWait(
		expectations.map(({ target }) => target),
		() =>
			expectations.every(({ attribute, target, value }) => target.getAttribute(attribute) === value) &&
			additionalMatch(),
	);
