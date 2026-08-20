# Choose and control priority

- Use `user-blocking` for work that directly blocks an active interaction.
- Use the default `user-visible` priority for visible work that does not immediately block interaction.
- Use `background` for work that is not time-sensitive or currently visible.
- Use an explicit `priority` option when the priority is immutable.
- Use a `TaskController` signal when queued tasks must be aborted or reprioritized together.
- Use `TaskSignal.any()` to compose abort sources with a fixed priority or another TaskSignal's priority.
