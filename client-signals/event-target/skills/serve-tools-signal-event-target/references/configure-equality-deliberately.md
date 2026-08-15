# Configure equality deliberately

- Rely on `Object.is` for ordinary scalar state.
- Supply `equals` only when a stable semantic comparison is cheaper or more accurate than object identity.
- Keep equality pure and consistent for every value returned by `read`.
