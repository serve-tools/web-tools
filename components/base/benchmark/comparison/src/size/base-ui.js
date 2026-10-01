import { Checkbox } from "@base-ui/react/checkbox";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import * as React from "react";
import { createRoot } from "react-dom/client";

const CheckboxApp = () => {
	const [checked, setChecked] = React.useState(true);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(Checkbox.Root, {
			checked,
			id: "weight-checkbox",
			name: "choice",
			nativeButton: true,
			onCheckedChange: setChecked,
			render: React.createElement("button", { type: "button" }),
			value: "on",
		}),
		React.createElement("label", { htmlFor: "weight-checkbox" }, "Option"),
	);
};

const SwitchApp = () => {
	const [checked, setChecked] = React.useState(true);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(Switch.Root, {
			checked,
			id: "weight-switch",
			name: "enabled",
			onCheckedChange: setChecked,
			value: "yes",
		}),
		React.createElement("label", { htmlFor: "weight-switch" }, "Enabled"),
	);
};

const TabsApp = () => {
	const [value, setValue] = React.useState("profile");
	return React.createElement(
		Tabs.Root,
		{ onValueChange: setValue, value },
		React.createElement(
			Tabs.List,
			{ "aria-label": "Account" },
			React.createElement(Tabs.Tab, { value: "profile" }, "Profile"),
			React.createElement(Tabs.Tab, { value: "settings" }, "Settings"),
		),
		React.createElement(Tabs.Panel, { keepMounted: true, value: "profile" }, "Profile content"),
		React.createElement(Tabs.Panel, { keepMounted: true, value: "settings" }, "Settings content"),
	);
};

const DialogApp = () => {
	const [open, setOpen] = React.useState(false);
	return React.createElement(
		Dialog.Root,
		{ modal: false, onOpenChange: setOpen, open },
		React.createElement(
			Dialog.Portal,
			{ keepMounted: true },
			React.createElement(Dialog.Popup, null, React.createElement(Dialog.Title, null, "Settings")),
		),
	);
};

const CombinedApp = () =>
	React.createElement(
		React.Fragment,
		null,
		React.createElement(CheckboxApp),
		React.createElement(SwitchApp),
		React.createElement(TabsApp),
		React.createElement(DialogApp),
	);

const mount = (component) =>
	createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(component));

export const mountCheckbox = () => mount(CheckboxApp);
export const mountSwitch = () => mount(SwitchApp);
export const mountTabs = () => mount(TabsApp);
export const mountDialog = () => mount(DialogApp);
export const mountCombined = () => mount(CombinedApp);
