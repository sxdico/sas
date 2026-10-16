import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['web.fixpro.playit.plus', 'fixpro.playit.plus'],
    // Fix para WebSocket HMR con playit.plus
    hmr: {
      host: '127.0.0.1',
      port: 5173,
      protocol: 'ws',
      // Evita que intente wss://web.fixpro.playit.plus y wss://127.0.0.1:undefined
      clientPort: 5173,
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
