/**
 * Minimal Node.js HTTP adapter for the TanStack Start production bundle.
 * The Vite build emits:
 *   dist/client/   — static assets (JS, CSS, images, public files)
 *   dist/server/server.js — SSR Web Fetch handler
 *
 * This file handles both: static files are served directly from dist/client/;
 * everything else is passed to the SSR handler. Zero extra dependencies.
 *
 * Usage:  node server.mjs
 * Env:    PORT (default 3000)
 */
import handler from './dist/server/server.js'
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const port = Number(process.env.PORT ?? 3000)
const rootDir = fileURLToPath(new URL('.', import.meta.url))
const clientDir = join(rootDir, 'dist', 'client')

const MIME = {
  '.js':    'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.html':  'text/html; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.webp':  'image/webp',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain; charset=utf-8',
  '.xml':   'application/xml',
}

/**
 * Try to serve a file from dist/client/. Returns true if the file was found
 * and the response was sent; false if the caller should fall through to SSR.
 *
 * Vite content-hashes asset filenames (e.g. styles-DdAKiDjc.css) so anything
 * under /assets/ can be cached for a year. Everything else (favicon, manifest,
 * robots.txt) gets a short cache so updates are picked up quickly.
 */
function serveStatic(req, res) {
  // Decode the path and strip query string / fragments
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    return false
  }

  // Reject path traversal attempts
  const filePath = join(clientDir, pathname)
  if (!filePath.startsWith(clientDir)) return false

  let stat
  try {
    stat = statSync(filePath)
  } catch {
    return false
  }
  if (!stat.isFile()) return false

  const ext  = extname(filePath).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  // Hashed assets → immutable; everything else → revalidate after 1 min
  const cc = pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=60'

  res.writeHead(200, {
    'Content-Type':   mime,
    'Content-Length': stat.size,
    'Cache-Control':  cc,
  })
  createReadStream(filePath).pipe(res)
  return true
}

const server = createServer(async (req, res) => {
  // Static assets take priority — no need to hit the SSR handler for them
  if (serveStatic(req, res)) return

  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url, `http://${host}`)

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x))
    else if (v != null) headers.set(k, v)
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET')
  const body = hasBody ? Readable.toWeb(req) : undefined

  const response = await handler.fetch(
    new Request(url, { method: req.method, headers, body, duplex: 'half' })
  )

  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))

  if (response.body) {
    Readable.fromWeb(response.body).pipe(res)
  } else {
    res.end()
  }
})

server.listen(port, () => {
  console.log(`30nama web listening on http://0.0.0.0:${port}`)
})

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`Received ${signal} — shutting down gracefully`)

  server.close(err => {
    if (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
    console.log('All connections closed — exiting')
    process.exit(0)
  })

  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
