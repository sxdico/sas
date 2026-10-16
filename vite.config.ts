import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// PLAYIT=1 -> modo túnel con HMR activado
// sin variable -> modo localhost normal
const isPlayit = process.env.PLAYIT === '1' || process.env.PLAYIT === 'true';
// Opcional: puedes pasar tu dominio para que no falle
const playitHost = process.env.PLAYIT_HOST || '';

export default defineConfig({
  plugins: [react()],

  server: {
    host: isPlayit ? '0.0.0.0' : '127.0.0.1',
    port: 5173,
    allowedHosts: true,
    
    hmr: isPlayit 
      ? {
          // Si pones tu dominio, lo usa. Si no, usa el host actual (funciona igual)
          host: playitHost || undefined,
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