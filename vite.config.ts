import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import habousHandler from './api/horaires.mjs'

function vercelResponse(response) {
      return {
            setHeader(name, value) {
                  response.setHeader(name, value)
                  return this
            },
            status(code) {
                  response.statusCode = code
                  return this
            },
            send(body) {
                  response.end(body)
                  return this
            },
            end() {
                  response.end()
                  return this
            },
      }
}

export default defineConfig({
      plugins: [
            tailwindcss(),
            {
                  name: '3alamates-habous-api-dev',
                  configureServer(server) {
                        server.middlewares.use('/api/horaires', function (request, response) {
                              habousHandler(request, vercelResponse(response))
                        })
                  },
            },
      ],
})
