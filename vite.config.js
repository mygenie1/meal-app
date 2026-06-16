import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: 새 SW가 즉시 활성화(skipWaiting)되고 클라이언트를 claim →
      // controllerchange 발생 → App.jsx에서 자동 1회 reload로 최신 빌드 적용.
      // (prompt 방식은 배너를 눌러야만 갱신돼 기기가 옛 캐시에 멈추는 문제가 있었음)
      registerType: 'autoUpdate',
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
        // 새 SW 즉시 활성화 + 현재 페이지 control 획득 → controllerchange → 자동 reload
        skipWaiting: true,
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
