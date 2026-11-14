// Generates the RBAC Evolution brand assets from the logo character art:
// logo.png / logo.webp (full emblem), favicon.png + apple-touch-icon.png (head crop, readable at 16–32 px)
// and og-image.png (text converted to outlines).
// Usage (repo root):
//   LOGO=<logo cut-out PNG, transparent background> \
//   FONTS=<dir with ChangaOne-Regular.ttf, PlusJakartaSans.ttf, Yellowtail-Regular.ttf> \
//   OPENTYPE=<path to opentype.js package> SHARP=<path to sharp package> \
//   node docs/scripts/brand.cjs docs/public/brand
const fs = require('fs')
const path = require('path')
const opentype = require(process.env.OPENTYPE)
const sharp = require(process.env.SHARP)
const out = process.argv[2]
const logo = process.env.LOGO
const font = (f) => opentype.loadSync(path.join(process.env.FONTS, f))
const display = font('ChangaOne-Regular.ttf')
const jakarta = font('PlusJakartaSans.ttf')
const script = font('Yellowtail-Regular.ttf')

const C = { accent: '#3B82F6', jade: '#00C896', ink: '#0A0C0E', paper: '#EDEDED', grey: '#8A8A8A' }

/** Text as an outlined path; returns { d, width }. */
function text(f, str, x, y, size) {
  let cx = x
  let d = ''
  for (const ch of str) {
    const g = f.charToGlyph(ch)
    d += g.getPath(cx, y, size).toPathData(2)
    cx += (g.advanceWidth / f.unitsPerEm) * size
  }
  return { d, width: cx - x }
}
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`

async function main() {
  fs.mkdirSync(out, { recursive: true })
  for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f))

  const full = sharp(logo).trim({ threshold: 1 })
  await full.clone().resize({ height: 512, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(path.join(out, 'logo.png'))
  await full.clone().resize({ height: 256 }).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(out, 'logo.webp'))

  // shortcut: the head crop is fixed for the current 525×640 logo art; re-pick it if the art changes.
  const { width, height } = await sharp(logo).metadata()
  if (width !== 525 || height !== 640) throw new Error(`Logo is ${width}×${height}; update the head crop in brand.cjs.`)
  const head = await sharp(logo).extract({ left: 95, top: 150, width: 330, height: 330 }).png().toBuffer()
  await sharp(head).resize(64, 64).png().toFile(path.join(out, 'favicon.png'))
  await sharp({ create: { width: 180, height: 180, channels: 4, background: C.ink } })
    .composite([{ input: await sharp(head).resize(164, 164).toBuffer(), left: 8, top: 8 }])
    .png()
    .toFile(path.join(out, 'apple-touch-icon.png'))

  // Open Graph image, 1200×630.
  const ogName = text(display, 'RBAC Evolution', 470, 290, 96)
  const ogScript = text(script, 'roles & permissions, cultivated.', 474, 380, 58)
  const ogLine = text(jakarta, 'Node.js & Bun  ·  every framework  ·  every database', 476, 450, 24)
  const grid = Array.from({ length: 22 }, (_, i) => `<path d="M${i * 56} 0V630M0 ${i * 56}H1200" stroke="#161b22" stroke-width="1"/>`).join('')
  const bg = svg(
    1200,
    630,
    `<rect width="1200" height="630" fill="${C.ink}"/>${grid}
  <path d="${ogName.d}" fill="${C.paper}"/>
  <path d="${ogScript.d}" fill="${C.jade}"/>
  <path d="${ogLine.d}" fill="${C.grey}"/>
  <rect x="476" y="478" width="300" height="4" rx="2" fill="${C.accent}"/>`,
  )
  await sharp(Buffer.from(bg))
    .composite([{ input: await full.clone().resize({ height: 470 }).toBuffer(), left: 50, top: 80 }])
    .png()
    .toFile(path.join(out, 'og-image.png'))
  console.log('ok')
}
main()
