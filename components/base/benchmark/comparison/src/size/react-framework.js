import * as React from "react";
import { createRoot } from "react-dom/client";

const App = () => {
	const [active, setActive] = React.useState(false);
	return React.createElement(
		"button",
		{ "aria-pressed": active, onClick: () => setActive(!active), type: "button" },
		"Framework baseline",
	);
};

createRoot(document.body.appendChild(document.createElement("div"))).render(React.createElement(App));
