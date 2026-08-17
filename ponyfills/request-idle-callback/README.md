# @serve-tools/ponyfill-request-idle-callback

The `@serve-tools/ponyfill-request-idle-callback` package implements APIs from the [W3C `requestIdleCallback` Working Draft](https://www.w3.org/TR/requestidlecallback/) without modifying the global environment.
The package root provides the browser scheduler, while explicit runtime exports provide server schedulers for Node.js, Bun, and Deno.

```ts
import { requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback";

requestIdleCallback(() => console.log("idle"));
```

## Install

```shell
npm install @serve-tools/ponyfill-request-idle-callback
```

## Schedule and cancel idle work

```ts
import { cancelIdleCallback, requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback";

const handle = requestIdleCallback(
	(deadline) => {
		while (deadline.timeRemaining() > 0) {
			// Perform a small unit of deferred work.
			break;
		}
	},
	{ timeout: 1_000 },
);

cancelIdleCallback(handle);
```

Callbacks run after an animation frame through a `MessageChannel`, with a maximum 50 millisecond deadline.
A callback whose timeout elapses first receives a deadline with `didTimeout` set to `true` and no remaining time.
Work is delayed while the document is hidden to reduce background activity.

The scheduling and cancellation pattern above is covered by the package's TypeScript fixture and browser tests.

## Schedule idle work in server runtimes

Choose the explicit export for the current runtime:

```ts
import { requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback/runtime/node";
// import { requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback/runtime/bun";
// import { requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback/runtime/deno";

requestIdleCallback((deadline) => {
	while (deadline.timeRemaining() > 0) {
		// Perform a small unit of deferred server work.
		break;
	}
});
```

Each runtime scheduler uses unreferenced handles, so pending idle work and its timeout do not keep the process alive.
Node.js delays idle periods when recent event-loop utilization is high.
Bun and Deno use their native immediate scheduling without utilization gating.
All three runtimes use a maximum 8 millisecond deadline and preserve the timeout, FIFO, cancellation, and nested-callback behavior of the browser scheduler.

## Public API

- `requestIdleCallback`: schedules one callback and returns its numeric cancellation handle.
- `cancelIdleCallback`: cancels a pending callback created by this module.
- `IdleDeadline`, `IdleRequestCallback`, and `IdleRequestOptions`: TypeScript contracts matching the web API.
- `runtime/node`, `runtime/bun`, and `runtime/deno`: runtime-specific functions and the same TypeScript contracts without global mutation.

## Ponyfill boundary

The exported functions always use the package's scheduler, even when the browser already provides native globals.
Root and `lib/*` imports share one browser cancellation domain.
Each explicit runtime export owns a separate cancellation domain.
No import installs or replaces `globalThis.requestIdleCallback` or `globalThis.cancelIdleCallback`.

## Compatibility

This browser ponyfill requires `document`, `performance`, `MessageChannel`, and `requestAnimationFrame`.
It cannot observe the browser's internal rendering or input queues, so its deadline is an approximation rather than a native idle period.
Importing the module does not install or replace any globals; initialization occurs on the first scheduled callback.

The server runtime exports require Node.js, Bun, or Deno with `setImmediate`, unreferenced timer handles, and `performance.now()`.
Only the Node.js export imports `node:perf_hooks` and uses `performance.eventLoopUtilization()`.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-request-idle-callback/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-request-idle-callback
npm test --workspace @serve-tools/ponyfill-request-idle-callback
npm run test:bun --workspace @serve-tools/ponyfill-request-idle-callback
npm run test:deno --workspace @serve-tools/ponyfill-request-idle-callback
npm run build --workspace @serve-tools/ponyfill-request-idle-callback
```

## License

[MIT-0](./LICENSE.md)
