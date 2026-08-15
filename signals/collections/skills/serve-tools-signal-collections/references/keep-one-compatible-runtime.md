# Keep one compatible runtime

Continue importing Signal from `@serve-tools/signal`, including when the application aliases a compatible implementation such as `signal-polyfill` under that dependency name.

To use `signal-polyfill`, install it under the dependency name:

```shell
npm install @serve-tools/signal@npm:signal-polyfill @serve-tools/signal-collections
```
