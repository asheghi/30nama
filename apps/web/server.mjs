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
