export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
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
    "shadcn-nuxt"
  ],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },
  colorMode: {
    classSuffix: ''
  },
  vue: {
    propsDestructure: true,
  },
});
