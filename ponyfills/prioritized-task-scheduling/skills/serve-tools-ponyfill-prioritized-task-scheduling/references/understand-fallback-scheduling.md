# Understand fallback scheduling

- Each callback and continuation runs in its own host task.
- Priorities order only work scheduled through this package; they cannot reprioritize browser-owned or third-party task sources.
- Window background work uses the package's idle-callback ponyfill with hidden-document forward progress.
- Worker priorities share a `MessageChannel`, while retaining package-local ordering.
- A direct `scheduler.yield()` call inherits the originating fallback callback's priority and abort signal.
- A `yield()` after another asynchronous suspension uses the fallback default because JavaScript cannot carry native scheduling state through arbitrary promise continuations.
