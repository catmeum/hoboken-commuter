import { defineConfig } from 'vite'
import { sharedConfig } from './vite.config.shared.js'

export default defineConfig({
  ...sharedConfig,
  base: '/mobile/',
  build: {
    outDir: 'dist/mobile',
    rollupOptions: {
      input: 'mobile.html',
    },
  },
})
