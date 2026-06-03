import { defineConfig } from 'vite'
import { sharedConfig } from './vite.config.shared.js'

export default defineConfig({
  ...sharedConfig,
  build: {
    outDir: 'dist/mobile',
    rollupOptions: {
      input: 'mobile.html',
    },
  },
})
