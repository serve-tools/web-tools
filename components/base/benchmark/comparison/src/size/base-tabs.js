import { TabsElement } from "@serve-tools/base-components/tabs";

export const mount = () => {
	customElements.define("weight-base-tabs", class extends TabsElement {});
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
