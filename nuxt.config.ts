import tailwindcss from '@tailwindcss/vite'

// Secrets are resolved at runtime, never baked into the build:
// - Docker / production: NUXT_APP_PASSWORD, NUXT_REDIS_URL (Nitro maps NUXT_* onto runtimeConfig)
// - Local dev: `nuxt dev` loads `.env` automatically; APP_PASSWORD / REDIS_URL are read
//   as fallbacks in server/utils/config.ts
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'TLD Buddy',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1b2230' },
        { name: 'color-scheme', content: 'dark' },
      ],
    },
  },

  css: [
    'leaflet/dist/leaflet.css',
    '~/assets/css/tailwind.css',
  ],

  routeRules: {
    // Client-rendered SPA, but with server routes enabled for API
    '/**': { ssr: false },
    // Static game assets never change between deploys of the same file name
    '/maps/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
    '/items/**': { headers: { 'cache-control': 'public, max-age=604800, stale-while-revalidate=86400' } },
    '/data/**': { headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },

  modules: ['shadcn-nuxt'],

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  nitro: {
    preset: 'node-server',
  },

  runtimeConfig: {
    // Empty defaults only — filled at runtime from NUXT_APP_PASSWORD / NUXT_REDIS_URL
    appPassword: '',
    redisUrl: '',
  },

  vite: {
    plugins: [tailwindcss()],
  },
})
