import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Wordscodex 智能词汇学习',
        short_name: 'Wordscodex',
        description: '以主动回忆和科学复习为核心的词汇学习平台',
        theme_color: '#335e2b',
        background_color: '#f6f8f3',
        display: 'standalone',
        lang: 'zh-CN',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
