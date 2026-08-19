# Configure the plugin

Install `@serve-tools/rolldown-decorators` as a development dependency and add `rolldownDecorators()` to the project's Rolldown or Vite `plugins` array.
The same plugin object works in both hosts.

Place the plugin before application-specific transforms that require decorator-free input.
Its transform hook already requests pre-order execution and leaves TypeScript and JSX syntax for the host's built-in transform.

Do not add a separate legacy decorator transform or enable `experimentalDecorators`.
The package reads Oxc's AST directly, does not invoke Babel or TypeScript, and emits the current standards-track decorator contract.

Keep the project's normal type-check command separate because the plugin transforms syntax without type-checking it.
