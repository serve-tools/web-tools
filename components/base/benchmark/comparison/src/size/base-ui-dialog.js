import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
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

export const mount = () =>
	createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
