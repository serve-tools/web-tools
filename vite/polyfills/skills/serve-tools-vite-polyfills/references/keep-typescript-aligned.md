# Keep TypeScript aligned

- Add or update ambient declarations when a polyfill augments a built-in interface not already covered by TypeScript libraries.
- Expose those declarations through the package's `./types` or focused type subpaths.
- Do not add redundant declarations for APIs already supplied by the configured TypeScript libs.
