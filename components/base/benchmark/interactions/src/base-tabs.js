import { TabsElement } from "@serve-tools/base-components/tabs";
import { afterMicrotask, measure, noAnimationStyle, prepareAttributeWait, prepareStateWait } from "./shared.js";

customElements.define("bench-base-tabs", class extends TabsElement {});

const container = document.body.appendChild(document.createElement("div"));
container.dataset.benchRoot = "";
let items = [];
let transitionCount = 0;

const createItem = (index) => {
	const element = document.createElement("bench-base-tabs");
	element.dataset.benchTabs = String(index);
	const list = document.createElement("div");
	list.slot = "tablist";
	list.setAttribute("aria-label", `Section ${index}`);
	const panels = [];
	const tabs = [];
	for (let tabIndex = 0; tabIndex < 3; ++tabIndex) {
		const tab = document.createElement("button");
		tab.type = "button";
		tab.value = `tab-${tabIndex}`;
		tab.textContent = `Tab ${tabIndex}`;
		list.append(tab);
		tabs.push(tab);
		const panel = document.createElement("section");
		panel.dataset.benchPanel = "";
		panel.slot = "panel";
		panel.style.animation = noAnimationStyle.animation;
		panel.style.transition = noAnimationStyle.transition;
		panel.textContent = `Panel ${tabIndex}`;
		panels.push(panel);
		element.append(panel);
	}
	element.prepend(list);
	const row = document.createElement("div");
	row.dataset.benchRow = String(index);
	row.append(element);
	return { element, index: 0, panelIdentity: panels[0], panels, row, tabIdentity: tabs[0], tabs };
};

const sink = () => {
	const first = items[0];
	const last = items.at(-1);
	if (
		items.length === 0 ||
		!first.row.isConnected ||
		!last.row.isConnected ||
		first.tabs[first.index].getAttribute("aria-selected") !== "true" ||
		last.tabs[last.index].getAttribute("aria-selected") !== "true"
	) {
		throw new Error("Base Tabs retained-reference invariant failed");
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
			item.row.isConnected &&
			item.tabs.every(
				(tab, index) =>
					tab.getAttribute("aria-selected") === String(index === 0) && tab.tabIndex === (index ? -1 : 0),
			) &&
			item.panels.every((panel, index) => panel.hidden === (index !== 0)),
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

const prepareSetSelected = (index) => {
	const expectations = items.flatMap((item) => [
		{ attribute: "hidden", target: item.panels[item.index], value: "" },
		{ attribute: "hidden", target: item.panels[index], value: null },
	]);
	const prepared = prepareAttributeWait(expectations);
	return {
		cleanup: prepared.cleanup,
		run: () =>
			prepared
				.run(() => {
					for (const item of items) {
						item.element.selectedIndex = item.index = index;
					}
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
			throw new Error("Base Tabs timed teardown invariant failed");
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
		if (
			!item.row.isConnected ||
			item.element.selectedIndex !== item.index ||
			item.element.tabs.length !== 3 ||
			item.element.panels.length !== 3 ||
			item.tabs[0] !== item.tabIdentity ||
			item.panels[0] !== item.panelIdentity ||
			item.tabs.some(
				(tab, tabIndex) =>
					tab.role !== "tab" ||
					tab.getAttribute("aria-selected") !== String(tabIndex === item.index) ||
					tab.tabIndex !== (tabIndex === item.index ? 0 : -1),
			) ||
			item.panels.some(
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
		throw new Error(`Base Tabs validation failed: ${failures.slice(0, 12)}`);
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
		throw new Error("Base Tabs teardown validation failed");
	}
	return { component: "tabs", firstState: 0, itemCount: 0, lastState: 0, transitionCount };
};

globalThis.__interactionBench = {
	component: "tabs",
	condition: "base",
	mount,
	setState: setSelected,
	teardown,
	update,
	validate,
	validateEmpty,
};
