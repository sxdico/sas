
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const isPlayit =
  process.env.PLAYIT === '1' ||
  process.env.PLAYIT === 'true';

const playitHost = process.env.PLAYIT_HOST || 'ifixsoft.online';

export default defineConfig({
  plugins: [react()],

  server: {
    host: isPlayit ? '0.0.0.0' : '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: true,

    hmr: isPlayit
      ? {
          host: playitHost,
          protocol: 'wss',
          clientPort: 443,
        }
      : {
          host: '127.0.0.1',
          port: 5173,
          protocol: 'ws',
        },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});