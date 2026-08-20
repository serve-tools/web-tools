# Preserve scheduling behavior

- Keep side-effect imports intact when global installation is intended.
- Preserve existing native scheduler and interface objects.
- Treat `scheduler.postTask` and `scheduler.yield` as one atomic native capability; never mix native and fallback methods.
- Treat fallback priorities as local ordering that cannot influence browser-owned task sources.
- Expect fallback continuation inheritance only for direct `yield()` calls before the originating callback returns.
- Keep dynamic tasks on one scheduler/control implementation when reprioritization matters.
