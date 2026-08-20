# Choose the import boundary

- Import the package root for side effects that install the Scheduling API when it is missing.
- Import `./apply` for the same explicit installation boundary.
- Import one `./apply/*` entry when only the complete scheduler or one interface boundary should be installed.
- Import `./scheduler` for the native-aware `scheduler` and `Scheduler` values, or import `./TaskController`, `./TaskSignal`, or `./TaskPriorityChangeEvent` for the other interface objects without global mutation.
- Use `@serve-tools/ponyfill-prioritized-task-scheduling` when native identity is irrelevant and global mutation is forbidden.
