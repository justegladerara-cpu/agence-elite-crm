#!/usr/bin/env node
// Petit serveur statique pour tester le site construit (gzip des textes, comme un CDN ; adresse inconnue → 404.html).
// Usage direct : node site/scripts/serveur.cjs site-dist 4180
'use strict'
const http = require('node:http')
const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
}

function demarrer(dossier, port = 0) {
  const dir = path.resolve(dossier)
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      if (p.endsWith('/')) p += 'index.html'
      let f = path.join(dir, p)
      let statut = 200
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        f = path.join(dir, '404.html')
        statut = 404
      }
      const type = TYPES[path.extname(f)] || 'application/octet-stream'
      let corps = fs.readFileSync(f)
      const h = { 'Content-Type': type, 'Cache-Control': 'no-store' }
      if (/^(text|application\/(json|xml)|image\/svg)/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        corps = zlib.gzipSync(corps, { level: 6 })
        h['Content-Encoding'] = 'gzip'
      }
      res.writeHead(statut, h)
      res.end(corps)
    })
    s.listen(port, '127.0.0.1', () => ok(s))
  })
}

module.exports = { demarrer }

if (require.main === module) {
  const [dossier = 'site-dist', port = '4180'] = process.argv.slice(2)
  demarrer(dossier, Number(port)).then((s) => console.log(`Site ${dossier} sur http://127.0.0.1:${s.address().port}`))
}
