import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // The "server-only" package throws unconditionally unless the bundler
    // sets Next.js's custom "react-server" resolve condition, which Vitest
    // doesn't. Point it at the package's own no-op build for tests only —
    // production behavior (enforced by Next's build) is unaffected.
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
});
