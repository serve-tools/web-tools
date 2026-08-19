import { rolldownDecorators } from "../src/rolldown-decorators.js";

/** Transform modern TC39 decorators before Rolldown or Vite lowers application syntax. */
export const decoratorsPlugin = rolldownDecorators();
