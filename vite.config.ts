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
      'process.env.VITE_META_PAGE_ID': JSON.stringify(env.META_PAGE_ID || '104499642745480'),
      'process.env.VITE_INSTAGRAM_ACCOUNT_ID': JSON.stringify(env.INSTAGRAM_ACCOUNT_ID || '17841471698421784'),
      'process.env.VITE_BUFFER_CHANNEL_ID': JSON.stringify(env.BUFFER_CHANNEL_ID || '6ada7779778b240e2f9221b8'),
      'process.env.VITE_META_ACCESS_TOKEN': JSON.stringify(env.META_ACCESS_TOKEN || ''),
      'process.env.VITE_BUFFER_ACCESS_TOKEN': JSON.stringify(env.BUFFER_ACCESS_TOKEN || ''),
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