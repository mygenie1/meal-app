import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // prompt: 새 SW가 waiting 상태로 대기 → App.jsx가 registration.waiting 감지 →
      // 배너 표시 → 사용자 클릭 → SKIP_WAITING 메시지 → controllerchange → 1회 reload.
      // autoUpdate는 자동으로 SKIP_WAITING을 처리해 배너 없이 controllerchange가 발생하므로
      // 배너 방식과 충돌함 (오탐 및 무한 reload 원인).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: '식탁일기',
        short_name: '식탁일기',
        description: '함께 먹는 순간을 기록해요',
        theme_color: '#6b4f3a',
        background_color: '#fdfcf9',
        display: 'standalone',
        start_url: 'https://siktakilgi.com/',
        scope: 'https://siktakilgi.com/',
        lang: 'ko',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // 앱 쉘 전체 프리캐시
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA: 오프라인에서도 라우팅 유지
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/offline\.html/],
        // 새 SW를 waiting 상태로 유지 (사용자가 배너 클릭 후 SKIP_WAITING 메시지로 활성화)
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // 개발 중 서비스워커 비활성화 (캐싱이 개발을 방해하지 않게)
        enabled: false,
      },
    }),
  ],
})
