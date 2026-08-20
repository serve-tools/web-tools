# @serve-tools/polyfill-prioritized-task-scheduling

The `@serve-tools/polyfill-prioritized-task-scheduling` package provides native-aware imports and global installation for the [Prioritized Task Scheduling API](https://wicg.github.io/scheduling-apis/).
It preserves a native scheduler as one complete implementation and installs the complete scheduler fallback when the global is absent.

```ts
import "@serve-tools/polyfill-prioritized-task-scheduling";

await scheduler.postTask(() => updateVisibleContent(), { priority: "user-blocking" });
```

## Install

```shell
npm install @serve-tools/polyfill-prioritized-task-scheduling
```

## Choose the import boundary

- Import the package root for side effects that install the Scheduling API when it is missing.
- Import `./apply` for the same explicit installation boundary.
- Import `./apply/scheduler`, `./apply/TaskController`, `./apply/TaskSignal`, or `./apply/TaskPriorityChangeEvent` for selective installation.
- Import `./scheduler` for the native-aware `scheduler` and `Scheduler` values, or import `./TaskController`, `./TaskSignal`, or `./TaskPriorityChangeEvent` for the other interface objects without changing globals.

The scheduler installer and native-aware export treat `scheduler`, `Scheduler`, `scheduler.postTask`, and `scheduler.yield` as one atomic browser capability.
They preserve the native scheduler when it exists and otherwise use the complete fallback scheduler; they never mix native and fallback methods.

## Relationship to the ponyfill

This package uses [`@serve-tools/ponyfill-prioritized-task-scheduling`](../../ponyfills/prioritized-task-scheduling/) for every missing implementation.
Use the ponyfill directly when global mutation is forbidden or deterministic fallback identity is preferred.

Fallback tasks retain the ponyfill's local priority ordering, one-callback-per-task behavior, abort semantics, dynamic reprioritization, Window background scheduling, and Worker support.
Fallback priorities cannot influence the browser's own task queues.
Fallback `yield()` inherits priority and cancellation only when called directly before its originating fallback callback returns, not after arbitrary promise or microtask suspensions.

## Agent Skill

This package includes `skills/serve-tools-polyfill-prioritized-task-scheduling/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-prioritized-task-scheduling
npm test --workspace @serve-tools/polyfill-prioritized-task-scheduling
npm run build --workspace @serve-tools/polyfill-prioritized-task-scheduling
```

## License

[MIT-0](./LICENSE.md)
