import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // prompt: 새 SW를 곧바로 활성화하지 않고 waiting 상태로 둔다.
      // 사용자가 "새로고침" 배너를 눌렀을 때만 SKIP_WAITING 메시지로 교체 → 1회 reload.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: '식탁일기',
        short_name: '식탁일기',
        description: '함께 먹는 순간을 기록해요',
        theme_color: '#6b4f3a',
        background_color: '#fdfcf9',
        display: 'standalone',
        start_url: '/',
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
        // 새 SW는 waiting 상태로 대기. 배너 클릭 시 SKIP_WAITING 메시지로 활성화.
        // clientsClaim: 활성화되면 현재 페이지를 즉시 control → controllerchange 발생 → reload
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
