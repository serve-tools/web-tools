import { defineConfig } from "vitest/config";

const projects = [
	"client/client/vitest.browser.config.ts",
	"client/context/vitest.browser.config.ts",
	"client/db/vitest.browser.config.ts",
	"client/event-source/vitest.browser.config.ts",
	"client/http-stream/vitest.browser.config.ts",
	"client/input/vitest.browser.config.ts",
	"client/interaction/vitest.browser.config.ts",
	"client/keyboard/vitest.browser.config.ts",
	"client/messaging/vitest.browser.config.ts",
	"client/shared-db/vitest.browser.config.ts",
	"client/shared-websocket/vitest.browser.config.ts",
	"client/storage/vitest.browser.config.ts",
	"client/websocket/vitest.browser.config.ts",
	"client/webtransport/vitest.browser.config.ts",
	"client-signals/event-target/vitest.browser.config.ts",
	"client-signals/messaging/vitest.browser.config.ts",
	"client-signals/storage/vitest.browser.config.ts",
	"client-signals/websocket/vitest.browser.config.ts",
	"core/async-operation/vitest.browser.config.ts",
	"lit/signals/vitest.browser.config.ts",
	"ponyfills/prioritized-task-scheduling/vitest.browser.config.ts",
	"ponyfills/request-idle-callback/vitest.browser.config.ts",
	"realtime/protocol/vitest.browser.config.ts",
	"signals/collections/vitest.browser.config.ts",
	"signals/effect/vitest.browser.config.ts",
	"signals/signal/vitest.browser.config.ts",
];

const [shard = 0, shardCount = 1] = (process.env.VITEST_BROWSER_PROJECT_SHARD ?? "0/1").split("/").map(Number);

if (!Number.isInteger(shard) || !Number.isInteger(shardCount) || shard < 0 || shard >= shardCount) {
	throw new Error(`Invalid VITEST_BROWSER_PROJECT_SHARD: ${process.env.VITEST_BROWSER_PROJECT_SHARD}`);
}

const selectedProjects = projects.filter((_, index) => index % shardCount === shard);

// @vitest/browser-playwright installs one temporary SIGTERM listener per browser instance in each project.
process.setMaxListeners(process.getMaxListeners() + selectedProjects.length * 3);

export default defineConfig({
	test: { projects: selectedProjects, browser: { connectTimeout: 120_000 } },
});
