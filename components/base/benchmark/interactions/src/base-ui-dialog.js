import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { afterMicrotask, measure, noAnimationStyle, prepareAttributeWait, prepareStateWait } from "./shared.js";

const container = document.body.appendChild(document.createElement("div"));
container.dataset.benchReactRoot = "";
const focusAnchor = document.createElement("button");
focusAnchor.textContent = "Open dialogs";
focusAnchor.type = "button";
document.body.prepend(focusAnchor);
const focusAnchorRef = { current: focusAnchor };
const root = createRoot(container);
let epoch = 0;
let items = [];
let transitionCount = 0;

const nodeRef = () => {
	const ref = { current: null };
	ref.callback = (node) => {
		ref.current = node;
	};
	return ref;
};

const DialogFixture = ({ index, item }) =>
	React.createElement(
		Dialog.Root,
		{ modal: false, onOpenChange() {}, open: item.open },
		React.createElement(
			Dialog.Portal,
			{ keepMounted: true },
			React.createElement(
				Dialog.Popup,
				{
					"data-bench-dialog": index,
					finalFocus: focusAnchorRef,
					initialFocus: item.focusRef,
					ref: item.popupRef.callback,
					style: noAnimationStyle,
				},
				React.createElement(Dialog.Title, { ref: item.titleRef.callback }, `Dialog ${index}`),
				React.createElement("button", { ref: item.focusRef.callback, type: "button" }, "Continue"),
			),
		),
	);

const App = ({ models }) =>
	React.createElement(
		React.Fragment,
		null,
		...models.map((item, index) =>
			React.createElement(
				"div",
				{ "data-bench-row": index, key: index },
				React.createElement(DialogFixture, { index, item }),
			),
		),
	);

const CommitSentinel = ({ resolve }) => {
	React.useLayoutEffect(() => queueMicrotask(resolve), [resolve]);
	return null;
};

const renderCommit = (content) =>
	new Promise((resolve) => {
		root.render(
			React.createElement(React.Fragment, null, content, React.createElement(CommitSentinel, { resolve })),
		);
	});

const render = () => renderCommit(React.createElement(App, { key: epoch, models: items }));

const sink = () => {
	const first = items[0];
	const last = items.at(-1);
	if (
		items.length === 0 ||
		!first.popupRef.current?.isConnected ||
		!last.popupRef.current?.isConnected ||
		first.popupRef.current.hidden !== !first.open ||
		last.popupRef.current.hidden !== !last.open ||
		(transitionCount > 0 && document.activeElement !== (first.open ? last.focusRef.current : focusAnchor))
	) {
		throw new Error("Base UI Dialog retained-reference invariant failed");
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
			item.popupRef.current?.isConnected &&
			item.popupRef.current.hidden &&
			item.titleRef.current?.isConnected &&
			getComputedStyle(item.popupRef.current).display === "none",
	);

const prepareClear = () => {
	const removed = items;
	const prepared = prepareStateWait(
		[document.documentElement],
		() =>
			container.childElementCount === 0 &&
			document.querySelector("[data-bench-dialog]") === null &&
			removed.every((item) => !item.popupRef.current?.isConnected),
		{ attributes: true, childList: true, subtree: true },
	);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared.run(async () => {
				await renderCommit(null);
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
	const prepared = prepareStateWait([document.documentElement], mountStateMatches, {
		attributes: true,
		childList: true,
		subtree: true,
	});
	const measured = await measure(async () => {
		await prepared.run(async () => {
			items = Array.from({ length: count }, () => ({
				focusRef: nodeRef(),
				open: false,
				popupRef: nodeRef(),
				titleRef: nodeRef(),
			}));
			transitionCount = 0;
			++epoch;
			await render();
		});
		sink();
	}, prepared.cleanup);
	for (const item of items) {
		item.popupIdentity = item.popupRef.current;
		item.titleIdentity = item.titleRef.current;
	}
	return { ...measured, sink: sink() };
};

const prepareSetOpen = (open) => {
	const prepared = prepareAttributeWait(
		items.map((item) => ({ attribute: "hidden", target: item.popupRef.current, value: open ? null : "" })),
		() => document.activeElement === (open ? items.at(-1).focusRef.current : focusAnchor),
	);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared
				.run(async () => {
					if (open) {
						focusAnchor.focus();
					}
					for (const item of items) {
						item.open = open;
					}
					await render();
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
		if (container.childElementCount !== 0 || document.querySelector("[data-bench-dialog]")) {
			throw new Error("Base UI Dialog timed teardown invariant failed");
		}
	}, prepared.cleanup);
	return {
		...measured,
		sink: { component: "dialog", firstState: 0, itemCount: 0, lastState: 0, transitionCount },
	};
};

const validate = () => {
	const failures = [];
	const focusOwner = items.findIndex((item) => item.focusRef.current === document.activeElement);
	for (const [index, item] of items.entries()) {
		const popup = item.popupRef.current;
		const title = item.titleRef.current;
		if (
			!popup?.isConnected ||
			!title?.isConnected ||
			popup !== item.popupIdentity ||
			title !== item.titleIdentity ||
			popup.role !== "dialog" ||
			popup.hidden !== !item.open ||
			popup.getAttribute("aria-labelledby") !== title.id ||
			(getComputedStyle(popup).display !== "none") !== item.open
		) {
			failures.push(index);
		}
	}
	if (
		transitionCount > 0 &&
		document.activeElement !== (items[0].open ? items.at(-1).focusRef.current : focusAnchor)
	) {
		failures.push("focus");
	}
	if (failures.length > 0) {
		throw new Error(`Base UI Dialog validation failed: ${failures.slice(0, 12)}`);
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
	if (
		items.length !== 0 ||
		container.childElementCount !== 0 ||
		document.querySelector("[data-bench-dialog]") !== null
	) {
		throw new Error("Base UI Dialog teardown validation failed");
	}
	return { component: "dialog", firstState: 0, itemCount: 0, lastState: 0, transitionCount };
};

globalThis.__interactionBench = {
	component: "dialog",
	condition: "base-ui",
	mount,
	setState: setOpen,
	teardown,
	update,
	validate,
	validateEmpty,
};
