import { mergeConfig } from "vitest/config";
import { flatNodeConfig } from "../../vitest.node.config.js";

export default mergeConfig(flatNodeConfig, {
	test: {
		setupFiles: [new URL("./test/setup.ts", import.meta.url).pathname],
	},
});
