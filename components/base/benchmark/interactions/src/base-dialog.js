import { DialogElement } from "@serve-tools/base-components/dialog";
import { afterMicrotask, measure, noAnimationStyle, prepareAttributeWait, prepareStateWait } from "./shared.js";

customElements.define("bench-base-dialog", class extends DialogElement {});

const container = document.body.appendChild(document.createElement("div"));
container.dataset.benchRoot = "";
const focusAnchor = document.createElement("button");
focusAnchor.textContent = "Open dialogs";
focusAnchor.type = "button";
document.body.prepend(focusAnchor);
let items = [];
let transitionCount = 0;

const createItem = (index) => {
	const element = document.createElement("bench-base-dialog");
	const dialog = document.createElement("dialog");
	dialog.dataset.benchDialog = String(index);
	dialog.setAttribute("aria-labelledby", `bench-dialog-title-${index}`);
	dialog.style.animation = noAnimationStyle.animation;
	dialog.style.transition = noAnimationStyle.transition;
	const title = document.createElement("h2");
	title.id = `bench-dialog-title-${index}`;
	title.textContent = `Dialog ${index}`;
	const focus = document.createElement("button");
	focus.type = "button";
	focus.textContent = "Continue";
	dialog.append(title, focus);
	element.append(dialog);
	const row = document.createElement("div");
	row.dataset.benchRow = String(index);
	row.append(element);
	return {
		dialog,
		dialogIdentity: dialog,
		element,
		focus,
		open: false,
		row,
		title,
		titleIdentity: title,
	};
};

const sink = () => {
	const first = items[0];
	const last = items.at(-1);
	if (
		items.length === 0 ||
		!first.row.isConnected ||
		!last.row.isConnected ||
		first.element.open !== first.open ||
		last.element.open !== last.open ||
		(transitionCount > 0 && document.activeElement !== (first.open ? last.focus : focusAnchor))
	) {
		throw new Error("Base Dialog retained-reference invariant failed");
	}
	return {
		component: "dialog",
		firstState: Number(first.open),
		itemCount: items.length,
		lastState: Number(last.open),
		transitionCount,
	};
};

const mountStateMatches = () =>
	items.every(
		(item) =>
			item.row.isConnected &&
			item.element.dialog === item.dialog &&
			item.dialog.getAttribute("open") === null &&
			getComputedStyle(item.dialog).display === "none",
	);

const prepareClear = () => {
	const removed = items;
	const prepared = prepareStateWait(
		[container],
		() => container.childElementCount === 0 && removed.every((item) => !item.row.isConnected),
		{ attributes: true, childList: true, subtree: true },
	);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared.run(async () => {
				for (const item of items) {
					if (item.dialog.open) {
						item.element.close();
					}
				}
				container.replaceChildren();
				items = [];
				await afterMicrotask();
			}),
	};
};

const clear = async () => {
	const prepared = prepareClear();
	try {
		await prepared.run();
	} finally {
		prepared.cleanup();
	}
};

const mount = async (count) => {
	if (items.length > 0) {
		await clear();
	}
	const prepared = prepareStateWait([container], mountStateMatches, {
		attributes: true,
		childList: true,
		subtree: true,
	});
	const measured = await measure(async () => {
		await prepared.run(async () => {
			items = Array.from({ length: count }, (_, index) => createItem(index));
			container.append(...items.map((item) => item.row));
			await afterMicrotask();
			transitionCount = 0;
		});
		sink();
	}, prepared.cleanup);
	return { ...measured, sink: sink() };
};

const prepareSetOpen = (open) => {
	const prepared = prepareAttributeWait(
		items.map((item) => ({ attribute: "open", target: item.dialog, value: open ? "" : null })),
		() => document.activeElement === (open ? items.at(-1).focus : focusAnchor),
	);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared
				.run(() => {
					if (open) {
						focusAnchor.focus();
					}
					for (const item of open ? items : items.toReversed()) {
						item.open = open;
						open ? item.element.show() : item.element.close();
					}
				})
				.then(() => {
					++transitionCount;
					return sink();
				}),
	};
};

const setOpen = async (open) => {
	const prepared = prepareSetOpen(open);
	try {
		return await prepared.run();
	} finally {
		prepared.cleanup();
	}
};

const update = async (repetitions) => {
	if (repetitions !== 1) {
		throw new RangeError("The interaction protocol requires one Dialog open-close cycle per observation");
	}
	const opening = prepareSetOpen(true);
	const closing = prepareSetOpen(false);
	const measured = await measure(
		async () => {
			await opening.run();
			await closing.run();
		},
		() => {
			opening.cleanup();
			closing.cleanup();
		},
	);
	return { ...measured, sink: sink() };
};

const teardown = async () => {
	const prepared = prepareClear();
	const measured = await measure(async () => {
		await prepared.run();
		if (container.childElementCount !== 0) {
			throw new Error("Base Dialog timed teardown invariant failed");
		}
	}, prepared.cleanup);
	return {
		...measured,
		sink: { component: "dialog", firstState: 0, itemCount: 0, lastState: 0, transitionCount },
	};
};

const validate = () => {
	const failures = [];
	const focusOwner = items.findIndex((item) => item.focus === document.activeElement);
	for (const [index, item] of items.entries()) {
		if (
			!item.row.isConnected ||
			item.element.dialog !== item.dialog ||
			item.dialog !== item.dialogIdentity ||
			item.title !== item.titleIdentity ||
			item.element.open !== item.open ||
			item.dialog.open !== item.open ||
			item.dialog.getAttribute("aria-labelledby") !== item.title.id ||
			(getComputedStyle(item.dialog).display !== "none") !== item.open
		) {
			failures.push(index);
		}
	}
	if (transitionCount > 0 && document.activeElement !== (items[0].open ? items.at(-1).focus : focusAnchor)) {
		failures.push("focus");
	}
	if (failures.length > 0) {
		throw new Error(`Base Dialog validation failed: ${failures.slice(0, 12)}`);
	}
	return {
		...sink(),
		focusOwner,
		focusRestored: !items[0].open && document.activeElement === focusAnchor,
		labelledCount: items.length,
		openCount: items.filter((item) => item.open).length,
		stableIdentity: true,
	};
};

const validateEmpty = () => {
	if (items.length !== 0 || container.childElementCount !== 0) {
		throw new Error("Base Dialog teardown validation failed");
	}
	return { component: "dialog", firstState: 0, itemCount: 0, lastState: 0, transitionCount };
};

globalThis.__interactionBench = {
	component: "dialog",
	condition: "base",
	mount,
	setState: setOpen,
	teardown,
	update,
	validate,
	validateEmpty,
};
