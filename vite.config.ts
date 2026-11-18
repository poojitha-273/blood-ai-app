import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const clientEnv = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, '..', '');

  const googleMapsKey =
    clientEnv.VITE_GOOGLE_MAPS_API_KEY ||
    rootEnv.VITE_GOOGLE_MAPS_API_KEY ||
    rootEnv.GOOGLE_MAP_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    '';

  const supabaseUrl =
    clientEnv.VITE_SUPABASE_URL ||
    rootEnv.VITE_SUPABASE_URL ||
    rootEnv.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';

  const supabaseAnonKey =
    clientEnv.VITE_SUPABASE_ANON_KEY ||
    rootEnv.VITE_SUPABASE_ANON_KEY ||
    rootEnv.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_API_URL': JSON.stringify(clientEnv.VITE_API_URL || 'https://blood-ai-mocha.vercel.app/api'),
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
