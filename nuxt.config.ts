import process from "node:process";

const sw = process.env.SW === "true";

export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  app: {
    head: {
      viewport:
        "width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0",
    },
  },
  appConfig: {
    // you don't need to include this: only for testing purposes
    buildDate: new Date().toISOString(),
  },
  future: {
    compatibilityVersion: 4,
  },
  runtimeConfig: {
    // Public keys that are exposed to the client
    public: {
      appVersion: process.env.npm_package_version,
      env: process.env.NODE_ENV as "DEVELOPMENT" | "PRODUCTION",
    },
  },
  devtools: { enabled: true },
  modules: [
    "@nuxt/devtools", 
    "@nuxtjs/tailwindcss",
    '@nuxtjs/color-mode',
    "@vite-pwa/nuxt", 
    "shadcn-nuxt"
  ],
  pwa: {
    strategies: sw ? "injectManifest" : "generateSW",
    srcDir: sw ? "service-worker" : undefined,
    filename: sw ? "sw.ts" : undefined,
    registerType: "autoUpdate",
    manifest: {
      orientation: "any",
      display: "standalone",
      lang: "en",
      name: "TLD Buddy",
      short_name: "TLD Buddy",
      start_url: "https://tld-buddy.immino.dev",
      scope: "https://tld-buddy.immino.dev",
      description: "TLD Buddy ",
      theme_color: "#8936FF",
      background_color: "#2EC6FE",
      icons: [
        {
          purpose: "maskable",
          sizes: "512x512",
          src: "icon512_maskable.png",
          type: "image/png",
        },
        {
          purpose: "any",
          sizes: "512x512",
          src: "icon512_rounded.png",
          type: "image/png",
        },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
    },
    injectManifest: {
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
    },
    client: {
      installPrompt: true,
      // you don't need to include this: only for testing purposes
      // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
      periodicSyncForUpdates: 20,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: "/",
      navigateFallbackAllowlist: [/^\/$/],
      type: "module",
    },
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },
  colorMode: {
    classSuffix: ''
  }
});
