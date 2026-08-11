# @serve-tools/ponyfill-request-idle-callback

An explicit-import implementation of `requestIdleCallback` and `cancelIdleCallback` that does not modify the global
environment.

## Install

```sh
npm install @serve-tools/ponyfill-request-idle-callback
```

## Recipes

### Schedule and cancel idle work

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

Callbacks run after an animation frame through a `MessageChannel`, with a maximum 50 millisecond deadline. A callback
whose timeout elapses first receives a deadline with `didTimeout` set to `true` and no remaining time. Work is delayed
while the document is hidden to reduce background activity.

The scheduling and cancellation pattern above is covered by the package's TypeScript fixture and browser tests.

## Exports

- `requestIdleCallback`: schedules one callback and returns its numeric cancellation handle.
- `cancelIdleCallback`: cancels a pending callback created by this module.
- `IdleDeadline`, `IdleRequestCallback`, and `IdleRequestOptions`: TypeScript contracts matching the web API.

## Ponyfill boundary

The exported functions always use the module's scheduler, even when the browser already provides native globals. They
share their own cancellation handles and never install or replace `globalThis.requestIdleCallback` or
`globalThis.cancelIdleCallback`.

## Compatibility

This browser ponyfill requires `document`, `performance`, `MessageChannel`, and `requestAnimationFrame`. It cannot observe
the browser's internal rendering or input queues, so its deadline is an approximation rather than a native idle period.
Importing the module does not install or replace any globals; initialization occurs on the first scheduled callback.

## Development

```sh
npm run typecheck --workspace @serve-tools/ponyfill-request-idle-callback
npm test --workspace @serve-tools/ponyfill-request-idle-callback
npm run build --workspace @serve-tools/ponyfill-request-idle-callback
```

## License

[MIT-0](./LICENSE.md)
