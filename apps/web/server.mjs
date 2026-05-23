/**
 * Minimal Node.js HTTP adapter for the TanStack Start production bundle.
 * The Vite build emits a Web Fetch handler at dist/server/server.js —
 * this wraps it in a plain node:http server with no extra dependencies.
 *
 * Usage:  node server.mjs
 * Env:    PORT (default 3000)
 */
import handler from './dist/server/server.js'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'

const port = Number(process.env.PORT ?? 3000)

const server = createServer(async (req, res) => {
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
// When the container runtime sends SIGTERM (docker stop, K8s rolling update,
// Fly/Render/ECS scale-in) we stop accepting new connections and wait for
// in-flight requests to finish before exiting. The 10-second timeout matches
// most orchestrators' default termination grace period.

function shutdown (signal) {
  console.log(`Received ${signal} — shutting down gracefully`)

  server.close(err => {
    if (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
    console.log('All connections closed — exiting')
    process.exit(0)
  })

  // Hard-exit if requests don't drain within the grace period so the
  // orchestrator isn't left waiting indefinitely.
  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
