import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use inline source maps in dev instead of eval-based ones, which avoids
  // the CSP 'unsafe-eval' warning in DevTools. Slightly slower HMR but
  // identical debugging experience.
  css: { devSourcemap: true },
  esbuild: { sourcemap: 'inline' },
})
