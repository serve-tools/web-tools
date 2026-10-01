import { SwitchElement } from "@serve-tools/base-components/switch";

export const mount = () => {
	customElements.define("weight-base-switch", class extends SwitchElement {});
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
