import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Single version source: the package manifest that ships next to dist/.
 * The published CLI is ESM, so the bin and this module share one manifest.
 */
const require = createRequire(fileURLToPath(import.meta.url));

export const cliVersion = require("../package.json").version as string;
