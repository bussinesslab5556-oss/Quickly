import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

// Fix for __dirname in ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // The third parameter '' loads all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true, // Ensures the app doesn't start on a random port if 3000 is busy
    },
    plugins: [react()],
    define: {
      // Global constants for Gemini AI and other services
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.PADDLE_CLIENT_TOKEN': JSON.stringify(env.PADDLE_CLIENT_TOKEN),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        // Aligns with the modular structure (components/, services/, etc.)
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: true, // Helpful for debugging production-ready code
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            utils: ['@google/genai', '@supabase/supabase-js'],
          },
        },
      },
    },
  };
});