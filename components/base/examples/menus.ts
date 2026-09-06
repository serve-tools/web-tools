import type { MenuElement } from "@serve-tools/base-components";

/** Connects local example actions while retaining native menu and link activation. */
export function initializeMenuExamples(): void {
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-command]")) {
		button.addEventListener("click", (event) => {
			if (event.defaultPrevented) {
				return;
			}
			button.closest(".preview")!.querySelector("output")!.textContent = `Action: ${button.dataset.command}`;
		});
	}
	const menu = document.querySelector<MenuElement>("#workspace-menu")!;
	menu.addEventListener("change", () => {
		const grid = menu.querySelector('[role="menuitemcheckbox"]')!;
		const theme = menu.querySelector('[role="menuitemradio"][aria-checked="true"]')!;
		document.querySelector("#menu-result")!.textContent =
			`Grid: ${grid.getAttribute("aria-checked") === "true" ? "on" : "off"}; theme: ${theme.textContent}`;
	});
}
