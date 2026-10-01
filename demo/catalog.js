const search = document.querySelector("#package-search");
const packages = [...document.querySelectorAll("[data-package]")];
search.addEventListener("input", () => {
	const query = search.value.trim().toLowerCase();
	let visible = 0;
	for (const entry of packages) {
		entry.hidden = !entry.dataset.search.includes(query);
		if (!entry.hidden) {
			++visible;
		}
	}
	for (const group of document.querySelectorAll("[data-group]")) {
		group.hidden = !group.querySelector("[data-package]:not([hidden])");
	}
	document.querySelector("#result-count").textContent = `Showing ${visible} of ${packages.length} packages`;
});
