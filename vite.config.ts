import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import path from "path";
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite";
import { viteMockServe } from "vite-plugin-mock";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "#": fileURLToPath(new URL("./types", import.meta.url)),
    },
  },
  plugins: [
    vue(),
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
    }),
    viteMockServe(),
  ],

  server: {
    open: true,
    port: 7777,
    strictPort: true,
    // 设置代理示例
    proxy: {
      "/XXApi": "https://blog.junfeng530.xyz/",
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/ai": {
        target: "https://api.lkeap.cloud.tencent.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, "/v1"),
      },
    },
  },
});
