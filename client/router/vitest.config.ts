import { mergeConfig } from "vitest/config";
import { flatNodeConfig } from "../../vitest.node.config.js";

export default mergeConfig(flatNodeConfig, {
	test: {
		setupFiles: [new URL("../../core/router/test/setup.ts", import.meta.url).pathname],
	},
});
