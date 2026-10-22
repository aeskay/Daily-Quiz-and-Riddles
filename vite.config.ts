import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.API_KEY || process.env.API_KEY || '';
  const pixabayKey = env.PIXABAY_KEY || process.env.PIXABAY_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.PIXABAY_KEY': JSON.stringify(pixabayKey),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api/buffer': {
          target: 'https://api.buffer.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/buffer/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: './index.html',
        },
      },
    },
  };
});