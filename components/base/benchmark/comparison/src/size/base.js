import { CheckboxElement } from "@serve-tools/base-components/checkbox";
import { DialogElement } from "@serve-tools/base-components/dialog";
import { SwitchElement } from "@serve-tools/base-components/switch";
import { TabsElement } from "@serve-tools/base-components/tabs";

const define = (name, constructor) => {
	if (!customElements.get(name)) {
		customElements.define(name, class extends constructor {});
	}
};

export const mountCheckbox = () => {
	define("weight-base-checkbox", CheckboxElement);
	const element = document.createElement("weight-base-checkbox");
	element.id = "weight-checkbox";
	element.name = "choice";
	element.value = "on";
	element.checked = true;
	const label = document.createElement("label");
	label.htmlFor = element.id;
	label.textContent = "Option";
	document.body.append(element, label);
};

export const mountSwitch = () => {
	define("weight-base-switch", SwitchElement);
	const element = document.createElement("weight-base-switch");
	element.id = "weight-switch";
	element.name = "enabled";
	element.value = "yes";
	element.checked = true;
	const label = document.createElement("label");
	label.htmlFor = element.id;
	label.textContent = "Enabled";
	document.body.append(element, label);
};

export const mountTabs = () => {
	define("weight-base-tabs", TabsElement);
	const element = document.createElement("weight-base-tabs");
	const list = document.createElement("div");
	list.slot = "tablist";
	list.setAttribute("aria-label", "Account");
	for (const [value, text] of [
		["profile", "Profile"],
		["settings", "Settings"],
	]) {
		const tab = document.createElement("button");
		tab.type = "button";
		tab.value = value;
		tab.textContent = text;
		list.append(tab);
		const panel = document.createElement("section");
		panel.slot = "panel";
		panel.textContent = `${text} content`;
		element.append(panel);
	}
	element.prepend(list);
	document.body.append(element);
};

export const mountDialog = () => {
	define("weight-base-dialog", DialogElement);
	const element = document.createElement("weight-base-dialog");
	const dialog = document.createElement("dialog");
	dialog.setAttribute("aria-labelledby", "weight-dialog-title");
	const title = document.createElement("h2");
	title.id = "weight-dialog-title";
	title.textContent = "Settings";
	dialog.append(title);
	element.append(dialog);
	document.body.append(element);
};

export const mountCombined = () => {
	mountCheckbox();
	mountSwitch();
	mountTabs();
	mountDialog();
};
