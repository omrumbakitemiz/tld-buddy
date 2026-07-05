import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'

// Load .env / .env.local before reading secrets into runtimeConfig
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: [
    'leaflet/dist/leaflet.css',
    '~/assets/css/tailwind.css',
  ],

  // Client-rendered SPA, but with server routes enabled for API
  routeRules: {
    '/**': { ssr: false },
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
    // Defaults only — Docker/production overrides via NUXT_* env vars at runtime
    appPassword: env.APP_PASSWORD || '',
    redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  },

  vite: {
    plugins: [tailwindcss()],
  },
})
