import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["@paymoapp/active-window"],
    },
  },
  // Tell Vite to keep __dirname working
  define: {
    __dirname: "__dirname",
  },

});
