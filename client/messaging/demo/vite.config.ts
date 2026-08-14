import { defineConfig } from "vite";

export default defineConfig({
	base: "./",
	build: {
		rollupOptions: {
			input: ["index.html", "requests.html", "shared-state.html", "cancellation.html", "transfers.html"],
		},
	},
});
