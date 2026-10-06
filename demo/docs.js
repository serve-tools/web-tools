const feedback = document.createElement("p");
feedback.className = "visually-hidden";
feedback.setAttribute("role", "status");
document.body.append(feedback);

if (navigator.clipboard?.writeText) {
	for (const button of document.querySelectorAll(".copy-code")) {
		button.hidden = false;
		button.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(button.closest(".code-example").querySelector("code").textContent);
				button.textContent = "Copied";
				feedback.textContent = "Example copied to clipboard.";
			} catch {
				button.textContent = "Select code to copy";
				feedback.textContent = "Clipboard access is unavailable. Select the example text to copy it.";
			}
		});
	}
}
