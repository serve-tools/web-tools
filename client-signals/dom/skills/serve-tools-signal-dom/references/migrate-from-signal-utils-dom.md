# Migrate from `@signal-utils/dom`

1. Replace the package specifier with `@serve-tools/signal-dom`.
2. Import runtime functions and the `DOM` type from the package root instead of `/pure`, `/hms`, or `/types`.
3. Import `Signal` from `@serve-tools/signal` and replace `use.Signal` references with that import.
4. Remove `use({ Signal })`; this package uses the shared Signal dependency directly.
5. Keep static values static so they continue to avoid reactive effects.
