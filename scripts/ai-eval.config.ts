import { defineConfig } from "vite";
// Isolate a measured run from reloads while the prototype is being edited.
export default defineConfig({
  server: { host: "127.0.0.1", port: 5176, hmr: false },
});
