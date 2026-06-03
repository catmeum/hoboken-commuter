import react from '@vitejs/plugin-react'

// Shared Vite configuration used by both desktop and mobile builds
export const sharedConfig = {
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
  },
  server: {
    proxy: {
      '/api/panynj': {
        target: 'https://www.panynj.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/panynj/, '/bin/portauthority'),
      },
      '/api/nws': {
        target: 'https://api.weather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nws/, ''),
        headers: {
          'User-Agent': 'MyStopNow/1.0 (transit-dashboard)',
        },
      },
      '/api/bus': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/path': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/ferry': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/mta': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/rail': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/weather': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/lirr': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/mnr': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/mtabus': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/nycferry': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/system-status': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/nearby-stops': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}
