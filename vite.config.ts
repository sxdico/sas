import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Detecta si estamos usando playit por variable de entorno
// npm run dev          -> modo LOCALHOST con HMR (reload activo)
// PLAYIT=1 npm run dev -> modo WEB.FIXPRO sin HMR (sin errores)
const isPlayit = process.env.PLAYIT === '1' || process.env.PLAYIT === 'true';

export default defineConfig({
  plugins: [react()],

  server: {
    host: isPlayit ? '0.0.0.0' : '127.0.0.1',
    port: 5173,
    allowedHosts: true,
    
    // AQUÍ ESTÁ LA MAGIA:
    // Si es localhost -> HMR activado con reload
    // Si es web.fixpro (PLAYIT=1) -> HMR desactivado para evitar el loop
    hmr: isPlayit 
      ? false 
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
