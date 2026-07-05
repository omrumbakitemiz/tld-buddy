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

  modules: [
    'shadcn-nuxt',
    '@vercel/analytics/nuxt',
    '@vercel/speed-insights/nuxt',
  ],

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  nitro: {
    preset: 'vercel',
  },

  // Server-only secrets — mapped from Vercel/Upstash env var names
  runtimeConfig: {
    appPassword: env.APP_PASSWORD || process.env.APP_PASSWORD || '',
    kvRestApiUrl: env.KV_REST_API_URL || process.env.KV_REST_API_URL || '',
    kvRestApiToken: env.KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '',
  },

  vite: {
    plugins: [tailwindcss()],
  },
})
