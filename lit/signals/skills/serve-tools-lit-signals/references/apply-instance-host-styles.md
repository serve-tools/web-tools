# Apply instance host styles

- Use Lit's re-exported `css` tag for static class styles.
- Decorate a standard auto-accessor with `@style` for one instance-owned constructed sheet containing a reactive `:host` rule.
- Write declaration names in CSS spelling, including kebab-case properties and custom properties.
- Pass static values, direct Signals, or zero-argument reactive callbacks as declaration values; treat `null` and `undefined` as declaration removal.
- Read the accessor as its declarations object; mutate reactive dependencies or replace the entire object because direct declaration-object mutation is not observed.
- Expect whole-object assignment to replace all declarations and sources while preserving the constructed sheet and cascade position.
- Annotate replaceable accessors with `style.Declarations` when assignments need a broader shape than the inferred initializer; use `style.Source` and `style.Value` for individual source and resolved-value annotations.
- Expect style subscriptions to pause after lasting disconnection and refresh on reconnection without rerendering; use `@style` only on `SignalElement` or `SignalWatcher` instances with a shadow render root that supports constructed stylesheets.
