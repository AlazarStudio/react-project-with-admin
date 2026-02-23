import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Плагин для обработки update-config.php
function updateConfigPlugin() {
  return {
    name: 'update-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/update-config.php' || req.url?.endsWith('/update-config.php')) {
          console.log('🔧 [Vite Plugin] Перехватил запрос:', req.method, req.url)
          
          if (req.method === 'OPTIONS') {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            })
            res.end()
            return
          }

          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          let body = ''
          req.on('data', chunk => {
            body += chunk.toString()
          })

          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              
              if (!data.backendApiUrl || !data.backendApiUrl.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'backendApiUrl is required' }))
                return
              }

              const backendApiUrl = data.backendApiUrl.trim()
              const configFile = path.join(__dirname, 'public', 'config.json')
              
              const config = {
                backendApiUrl: backendApiUrl
              }

              fs.writeFileSync(
                configFile,
                JSON.stringify(config, null, 2),
                'utf-8'
              )

              console.log('✅ config.json обновлен:', backendApiUrl)

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              })
              res.end(JSON.stringify({
                success: true,
                message: 'Config updated successfully',
                backendApiUrl: backendApiUrl
              }))
            } catch (parseError) {
              console.error('❌ Ошибка парсинга JSON:', parseError)
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid JSON' }))
            }
          })
        } else {
          next()
        }
      })
    }
  }
}

// Читаем config.json для определения URL бэкенда (если есть)
function getBackendUrlFromConfig() {
  try {
    const configFile = path.join(__dirname, 'public', 'config.json')
    if (fs.existsSync(configFile)) {
      const configContent = fs.readFileSync(configFile, 'utf-8')
      const config = JSON.parse(configContent)
      if (config.backendApiUrl && config.backendApiUrl.trim()) {
        return config.backendApiUrl.trim()
      }
    }
  } catch (error) {
    // Если не удалось прочитать - используем дефолтный
    console.log('Не удалось прочитать config.json для прокси, используем дефолтный URL')
  }
  return null
}

// Только backendApiUrl из config (или VITE_BACKEND_URL). Без дефолта на localhost:5000.
const backendUrlFromConfig = getBackendUrlFromConfig()
const proxyTarget = backendUrlFromConfig || process.env.VITE_BACKEND_URL || null

console.log('🔧 Прокси настроен на:', proxyTarget ?? '(не задан — укажите backendApiUrl в config.json или VITE_BACKEND_URL)')

export default defineConfig({
  plugins: [react(), updateConfigPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: proxyTarget ? {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    } : {},
    // Middleware для обработки POST запросов к update-config.php в dev режиме
    middlewareMode: false,
  },
})
