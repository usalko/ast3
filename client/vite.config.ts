import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/graphql": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false, // disable in prod for security
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          antd: ["antd", "@ant-design/icons"],
          refine: ["@refinedev/core", "@refinedev/antd"],
          charts: ["recharts"],
        },
      },
    },
  },
});
