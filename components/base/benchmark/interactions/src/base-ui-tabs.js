import { Tabs } from "@base-ui/react/tabs";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { afterMicrotask, measure, noAnimationStyle, prepareAttributeWait, prepareStateWait } from "./shared.js";

const container = document.body.appendChild(document.createElement("div"));
container.dataset.benchReactRoot = "";
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

const createItem = () => ({
	index: 0,
	panelRefs: Array.from({ length: 3 }, nodeRef),
	tabRefs: Array.from({ length: 3 }, nodeRef),
});

const TabsFixture = ({ index, item }) =>
	React.createElement(
		Tabs.Root,
		{ "data-bench-tabs": index, onValueChange() {}, value: `tab-${item.index}` },
		React.createElement(
			Tabs.List,
			{ "aria-label": `Section ${index}` },
			...item.tabRefs.map((ref, tabIndex) =>
				React.createElement(
					Tabs.Tab,
					{ key: tabIndex, ref: ref.callback, value: `tab-${tabIndex}` },
					`Tab ${tabIndex}`,
				),
			),
		),
		...item.panelRefs.map((ref, panelIndex) =>
			React.createElement(
				Tabs.Panel,
				{
					"data-bench-panel": "",
					keepMounted: true,
					key: panelIndex,
					ref: ref.callback,
					style: noAnimationStyle,
					value: `tab-${panelIndex}`,
				},
				`Panel ${panelIndex}`,
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
				React.createElement(TabsFixture, { index, item }),
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
		!first.tabRefs[first.index].current?.isConnected ||
		!last.tabRefs[last.index].current?.isConnected ||
		first.tabRefs[first.index].current.getAttribute("aria-selected") !== "true" ||
		last.tabRefs[last.index].current.getAttribute("aria-selected") !== "true"
	) {
		throw new Error("Base UI Tabs retained-reference invariant failed");
	}
	return {
		component: "tabs",
		firstState: first.index,
		itemCount: items.length,
		lastState: last.index,
		transitionCount,
	};
};

const mountStateMatches = () =>
	items.every(
		(item) =>
			item.tabRefs.every(
				(ref, index) =>
					ref.current?.isConnected &&
					ref.current.getAttribute("aria-selected") === String(index === 0) &&
					ref.current.tabIndex === (index ? -1 : 0),
			) && item.panelRefs.every((ref, index) => ref.current?.isConnected && ref.current.hidden === (index !== 0)),
	);

const prepareClear = () => {
	const removed = items;
	const prepared = prepareStateWait(
		[container],
		() =>
			container.childElementCount === 0 &&
			removed.every(
				(item) =>
					item.tabRefs.every((ref) => !ref.current?.isConnected) &&
					item.panelRefs.every((ref) => !ref.current?.isConnected),
			),
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
	const prepared = prepareStateWait([container], mountStateMatches, {
		attributes: true,
		childList: true,
		subtree: true,
	});
	const measured = await measure(async () => {
		await prepared.run(async () => {
			items = Array.from({ length: count }, createItem);
			transitionCount = 0;
			++epoch;
			await render();
		});
		sink();
	}, prepared.cleanup);
	for (const item of items) {
		item.panelIdentity = item.panelRefs[0].current;
		item.tabIdentity = item.tabRefs[0].current;
	}
	return { ...measured, sink: sink() };
};

const prepareSetSelected = (index) => {
	const expectations = items.flatMap((item) => [
		{ attribute: "hidden", target: item.panelRefs[item.index].current, value: "" },
		{ attribute: "hidden", target: item.panelRefs[index].current, value: null },
	]);
	const prepared = prepareAttributeWait(expectations);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared
				.run(async () => {
					for (const item of items) {
						item.index = index;
					}
					await render();
				})
				.then(() => {
					++transitionCount;
					return sink();
				}),
	};
};

const setSelected = async (index) => {
	const prepared = prepareSetSelected(index);
	try {
		return await prepared.run();
	} finally {
		prepared.cleanup();
	}
};

const update = async (repetitions) => {
	if (repetitions !== 1) {
		throw new RangeError("The interaction protocol requires one Tabs switch per observation");
	}
	const prepared = prepareSetSelected((items[0].index + 1) % 3);
	const measured = await measure(prepared.run, prepared.cleanup);
	return { ...measured, sink: sink() };
};

const teardown = async () => {
	const prepared = prepareClear();
	const measured = await measure(async () => {
		await prepared.run();
		if (container.childElementCount !== 0) {
			throw new Error("Base UI Tabs timed teardown invariant failed");
		}
	}, prepared.cleanup);
	return {
		...measured,
		sink: { component: "tabs", firstState: 0, itemCount: 0, lastState: 0, transitionCount },
	};
};

const validate = () => {
	const failures = [];
	for (const [index, item] of items.entries()) {
		const tabs = item.tabRefs.map((ref) => ref.current);
		const panels = item.panelRefs.map((ref) => ref.current);
		if (
			tabs.some((tab) => !tab?.isConnected) ||
			panels.some((panel) => !panel?.isConnected) ||
			tabs[0] !== item.tabIdentity ||
			panels[0] !== item.panelIdentity ||
			tabs.some(
				(tab, tabIndex) =>
					tab.role !== "tab" ||
					tab.getAttribute("aria-selected") !== String(tabIndex === item.index) ||
					tab.tabIndex !== (tabIndex === item.index ? 0 : -1),
			) ||
			panels.some(
				(panel, panelIndex) =>
					panel.role !== "tabpanel" ||
					panel.hidden !== (panelIndex !== item.index) ||
					!panel.hasAttribute("aria-labelledby"),
			)
		) {
			failures.push(index);
		}
	}
	if (failures.length > 0) {
		throw new Error(`Base UI Tabs validation failed: ${failures.slice(0, 12)}`);
	}
	return {
		...sink(),
		hiddenPanelCount: items.length * 2,
		selectedIndices: items.map((item) => item.index),
		stableIdentity: true,
	};
};

const validateEmpty = () => {
	if (items.length !== 0 || container.childElementCount !== 0) {
		throw new Error("Base UI Tabs teardown validation failed");
	}
	return { component: "tabs", firstState: 0, itemCount: 0, lastState: 0, transitionCount };
};

globalThis.__interactionBench = {
	component: "tabs",
	condition: "base-ui",
	mount,
	setState: setSelected,
	teardown,
	update,
	validate,
	validateEmpty,
};
