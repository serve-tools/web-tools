# @serve-tools/ponyfill-prioritized-task-scheduling

The `@serve-tools/ponyfill-prioritized-task-scheduling` package implements the [Prioritized Task Scheduling API](https://wicg.github.io/scheduling-apis/) without modifying the global environment.
It provides a module-scoped scheduler, task controls, dynamic priorities, abortable delays, and prioritized continuations in windows and workers.

```ts
import { scheduler } from "@serve-tools/ponyfill-prioritized-task-scheduling";

await scheduler.postTask(() => updateVisibleContent(), { priority: "user-blocking" });
```

## Install

```shell
npm install @serve-tools/ponyfill-prioritized-task-scheduling
```

## Control task priority and cancellation

```ts
import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

const controller = new TaskController({ priority: "background" });
const task = scheduler.postTask(() => prepareOffscreenContent(), { signal: controller.signal });

controller.setPriority("user-visible");

await task;
```

`TaskController` extends `AbortController`.
Its `TaskSignal` remains usable by APIs that accept an `AbortSignal`, dispatches `prioritychange` events, and reprioritizes all queued scheduler work associated with the signal.
An explicit `postTask` priority overrides the signal's priority and remains immutable.

## Yield between chunks

```ts
await scheduler.postTask(
	async () => {
		processFirstChunk();
		await scheduler.yield();
		processSecondChunk();
	},
	{ priority: "user-blocking" },
);
```

Continuations run ahead of newly posted work at the same priority.
A `yield()` called directly before the originating callback returns inherits that callback's priority and abort signal.
JavaScript cannot preserve the browser's internal scheduling state through arbitrary promise and microtask continuations, so a `yield()` called after another asynchronous suspension uses the default `user-visible` fallback priority.

## Public API

- `scheduler.postTask(callback, options)`: schedules one callback and resolves with its result.
- `scheduler.yield()`: yields to a separately scheduled continuation.
- `Scheduler`: the non-constructible interface object for `scheduler` instances.
- `TaskController`: aborts and reprioritizes tasks sharing its signal.
- `TaskSignal`: extends `AbortSignal` with `priority`, `prioritychange`, and `TaskSignal.any()`.
- `TaskPriorityChangeEvent`: exposes the previous priority.
- Scheduling options, callbacks, priorities, controls, signals, and event contracts are exported as TypeScript types.

## Scheduling behavior

Each posted callback or continuation runs in a separate host task, preserving a microtask checkpoint and an opportunity for the host to process unrelated work between callbacks.
Tasks are selected by effective priority and then global enqueue order.
Continuations rank immediately above newly posted tasks at the same semantic priority.

In windows, `user-blocking` and `user-visible` work uses a `MessageChannel`.
`background` work uses `@serve-tools/ponyfill-request-idle-callback` with a ten-second timeout for hidden-document forward progress.
In workers, all priorities use a `MessageChannel`, so priority ordering is local to this scheduler.

The fallback cannot communicate priority to the browser or coordinate with tasks from other sources.
`user-blocking` and `user-visible` therefore differ in their ordering within this package, not in browser-controlled event-loop priority.

## Ponyfill boundary

The exported scheduler and task controls always use this package's implementation, even when native globals exist.
No import installs or replaces `globalThis.scheduler`, `globalThis.TaskController`, `globalThis.TaskSignal`, or `globalThis.TaskPriorityChangeEvent`.
Use `@serve-tools/polyfill-prioritized-task-scheduling` when native identity or global installation is required.

## Compatibility

The package requires modern `AbortController`, `AbortSignal`, `DOMException`, `EventTarget`, `MessageChannel`, promises, and timers.
Window background scheduling additionally requires `document`, `performance`, and `requestAnimationFrame` through the idle-callback ponyfill.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-prioritized-task-scheduling/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-prioritized-task-scheduling
npm test --workspace @serve-tools/ponyfill-prioritized-task-scheduling
npm run build --workspace @serve-tools/ponyfill-prioritized-task-scheduling
```

## License

[MIT-0](./LICENSE.md)
