/** The full component roster, including capabilities retained from the Base donor. */
export const families = [
	["button", "Button", "Forms"],
	["checkbox", "Checkbox", "Forms"],
	["checkbox-group", "Checkbox Group", "Forms"],
	["field", "Field", "Forms"],
	["fieldset", "Fieldset", "Forms"],
	["form", "Form", "Forms"],
	["input", "Input", "Forms"],
	["number-field", "Number Field", "Forms"],
	["otp-field", "OTP Field", "Forms"],
	["radio", "Radio", "Forms"],
	["radio-group", "Radio Group", "Forms"],
	["select", "Select", "Forms"],
	["slider", "Slider", "Forms"],
	["switch", "Switch", "Forms"],
	["toggle", "Toggle", "Forms"],
	["toggle-group", "Toggle Group", "Forms"],
	["accordion", "Accordion", "Navigation"],
	["autocomplete", "Autocomplete", "Navigation"],
	["collapsible", "Collapsible", "Navigation"],
	["combobox", "Combobox", "Navigation"],
	["context-menu", "Context Menu", "Navigation"],
	["menu", "Menu", "Navigation"],
	["menubar", "Menubar", "Navigation"],
	["navigation-menu", "Navigation Menu", "Navigation"],
	["tabs", "Tabs", "Navigation"],
	["toolbar", "Toolbar", "Navigation"],
	["alert-dialog", "Alert Dialog", "Layers"],
	["dialog", "Dialog", "Layers"],
	["drawer", "Drawer", "Layers"],
	["popover", "Popover", "Layers"],
	["preview-card", "Preview Card", "Layers"],
	["toast", "Toast", "Layers"],
	["tooltip", "Tooltip", "Layers"],
	["avatar", "Avatar", "Display"],
	["meter", "Meter", "Display"],
	["progress", "Progress", "Display"],
	["scroll-area", "Scroll Area", "Display"],
	["separator", "Separator", "Display"],
	["calendar", "Calendar", "Base capabilities"],
	["file", "File selection", "Base capabilities"],
	["time", "Time", "Base capabilities"],
	["drag-drop", "Drag and drop", "Base capabilities"],
	["context", "Context", "Base capabilities"],
	["base", "Signal layout and lifecycle", "Base capabilities"],
] as const;

/** Creates navigation and markup previews without treating missing components as working examples. */
export function initializeGallery(): void {
	const navigation = document.querySelector<HTMLElement>("#component-navigation")!;
	const pendingList = document.querySelector<HTMLElement>("#pending-components")!;
	const search = document.querySelector<HTMLInputElement>("#component-search")!;
	const category = document.querySelector<HTMLSelectElement>("#component-category")!;
	const count = document.querySelector<HTMLElement>("#component-count")!;
	const empty = document.querySelector<HTMLElement>("#empty-results")!;
	const pending = document.querySelector<HTMLElement>("#pending")!;
	const sections = new Map<string, HTMLElement>();
	const categories = new Map<string, HTMLUListElement>();
	const entries: {
		name: string;
		category: string;
		navigation: HTMLLIElement;
		content: HTMLElement;
		pending: boolean;
	}[] = [];

	for (const section of document.querySelectorAll<HTMLElement>("[data-component]")) {
		sections.set(section.dataset.component!, section);
		const preview = section.querySelector<HTMLElement>(".preview");
		const code = section.querySelector<HTMLElement>("pre code");
		if (preview && code) {
			const lines = preview.innerHTML.trim().split("\n");
			const indentation = Math.min(
				...lines
					.slice(1)
					.filter((line) => line.trim())
					.map((line) => /^\s*/.exec(line)![0].length),
			);
			code.textContent = lines.map((line, index) => (index ? line.slice(indentation) : line)).join("\n");
		}
	}

	for (const [id, name, familyCategory] of families) {
		let list = categories.get(familyCategory);
		if (!list) {
			const heading = document.createElement("h2");
			heading.textContent = familyCategory;
			list = document.createElement("ul");
			navigation.append(heading, list);
			categories.set(familyCategory, list);
			category.add(new Option(familyCategory, familyCategory));
		}

		const item = document.createElement("li");
		const link = document.createElement("a");
		link.href = "#component-" + id;
		link.textContent = name;
		item.append(link);
		list.append(item);

		const section = sections.get(id);
		let content: HTMLElement;
		if (section) {
			content = section;
		} else {
			content = document.createElement("li");
			content.id = "component-" + id;
			const label = document.createElement("strong");
			label.textContent = name;
			const status = document.createElement("span");
			status.textContent = "Not implemented";
			content.append(label, status);
			pendingList.append(content);
			link.classList.add("pending-link");
			link.setAttribute("aria-label", name + " — not implemented");
		}
		entries.push({ name, category: familyCategory, navigation: item, content, pending: !section });
	}

	const implementedCount = families.filter(
		([id, , group]) => group !== "Base capabilities" && sections.has(id),
	).length;
	count.textContent = implementedCount + " of 38 Base UI families have examples";

	const filter = (): void => {
		const query = search.value.trim().toLocaleLowerCase();
		let visible = 0;
		let pendingVisible = 0;
		for (const entry of entries) {
			const matches =
				(!category.value || category.value === entry.category) &&
				(!query || (entry.name + " " + entry.category).toLocaleLowerCase().includes(query));
			entry.navigation.hidden = entry.content.hidden = !matches;
			if (matches) {
				++visible;
				if (entry.pending) {
					++pendingVisible;
				}
			}
		}
		for (const list of categories.values()) {
			const hidden = Array.from(list.children).every((item) => (item as HTMLElement).hidden);
			list.hidden = hidden;
			(list.previousElementSibling as HTMLElement).hidden = hidden;
		}
		empty.hidden = visible !== 0;
		pending.hidden = pendingVisible === 0;
	};

	search.addEventListener("input", filter);
	category.addEventListener("change", filter);
	filter();
}
