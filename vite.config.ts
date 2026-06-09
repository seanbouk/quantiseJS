import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // served from https://seanbouk.github.io/quantiseJS/ in production; root in dev
  base: command === 'build' ? '/quantiseJS/' : '/',
  plugins: [react()],
  server: {
    port: 5199,
    strictPort: true,
  },
}))
