import tailwindcss from '@tailwindcss/vite'

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
    preset: 'vercel',
  },

  vite: {
    plugins: [tailwindcss()],
  },
})
