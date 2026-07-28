import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 简单的文件日志插件
const fileLoggerPlugin = () => {
  const logDir = path.resolve(__dirname, 'logs')
  const logFile = path.join(logDir, 'vite.log')

  return {
    name: 'file-logger',
    apply: 'serve' as const,
    
    configureServer(server: any) {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }
      
      const writeLog = (level: string, msg: string) => {
        const timestamp = new Date().toISOString()
        const logLine = `${timestamp} [${level}] ${msg}\n`
        fs.appendFileSync(logFile, logLine)
      }
      
      server.httpServer?.on('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' ? addr?.port : addr
        const msg = `Vite Dev Server started on http://localhost:${port}`
        writeLog('INFO', msg)
      })
      
      const originalError = console.error
      console.error = (...args: any[]) => {
        writeLog('ERROR', args.map(a => String(a)).join(' '))
        originalError.apply(console, args)
      }
      
      writeLog('INFO', 'Logger initialized')
    }
  }
}

export default defineConfig({
  plugins: [react(), fileLoggerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'editor-vendor': ['@uiw/react-md-editor', 'react-markdown'],
        },
      },
    },
  },
  logLevel: 'info',
})
