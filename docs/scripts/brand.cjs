// Generates the RBAC Evolution brand assets (mark, favicon, wordmarks, og image).
// Text is converted to outlines, so the SVGs render the same everywhere (GitHub, npm).
// Usage (repo root):
//   FONTS=<dir with ChangaOne-Regular.ttf, PlusJakartaSans.ttf, Yellowtail-Regular.ttf> \
//   OPENTYPE=<path to opentype.js package> SHARP=<path to sharp package> \
//   node docs/scripts/brand.cjs docs/public/brand
const fs = require('fs')
const path = require('path')
const opentype = require(process.env.OPENTYPE)
const sharp = require(process.env.SHARP)
const out = process.argv[2]
const font = (f) => opentype.loadSync(path.join(process.env.FONTS, f))
const display = font('ChangaOne-Regular.ttf')
const jakarta = font('PlusJakartaSans.ttf')
const script = font('Yellowtail-Regular.ttf')

const C = { accent: '#3B82F6', jade: '#00C896', ink: '#0A0C0E', paper: '#EDEDED', grey: '#8A8A8A' }

/** Text as an outlined path; returns { d, width }. letterSpacing in em. */
function text(f, str, x, y, size, letterSpacing = 0) {
  let cx = x
  let d = ''
  for (const ch of str) {
    const g = f.charToGlyph(ch)
    d += g.getPath(cx, y, size).toPathData(2)
    cx += (g.advanceWidth / f.unitsPerEm) * size + letterSpacing * size
  }
  return { d, width: cx - x }
}

/** 64×64 mark: chamfered blue badge, ink key with a hexagon bow, jade core, three realm bars. */
function mark() {
  const hex = [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const r = (a - 90) * (Math.PI / 180)
      return `${(32 + 9 * Math.cos(r)).toFixed(2)},${(21 + 9 * Math.sin(r)).toFixed(2)}`
    })
    .join(' ')
  return `<path d="M12 2H62V52L52 62H2V12Z" fill="${C.accent}"/>
  <polygon points="${hex}" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linejoin="miter"/>
  <circle cx="32" cy="21" r="3" fill="${C.jade}"/>
  <path d="M30 29.5H34V54H30Z M34 42H41V46H34Z M34 49H39V53H34Z" fill="${C.ink}"/>
  <path d="M10 54H14V48H10Z M16 54H20V43H16Z M22 54H26V38H22Z" fill="${C.ink}"/>`
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`

fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f))

fs.writeFileSync(path.join(out, 'mark.svg'), svg(64, 64, mark()))
fs.writeFileSync(path.join(out, 'favicon.svg'), svg(64, 64, mark()))

function wordmark(textColor) {
  const name = text(display, 'RBAC Evolution', 92, 56, 46)
  const tag = text(jakarta, 'ROLES · PERMISSIONS · CULTIVATED', 94, 88, 12, 0.32)
  const w = Math.ceil(Math.max(name.width, tag.width) + 104)
  return svg(
    w,
    104,
    `<g transform="translate(4 14) scale(1.1)">${mark()}</g>
  <path d="${name.d}" fill="${textColor}"/>
  <path d="${tag.d}" fill="${C.grey}"/>
  <path d="M94 96H${w - 18}V99H94Z" fill="${C.accent}"/>
  <path d="M${w - 12} 91.5L${w - 5} 97.5L${w - 12} 103.5L${w - 19} 97.5Z" fill="${C.jade}" transform="translate(0 -1)"/>`,
  )
}
fs.writeFileSync(path.join(out, 'wordmark-light.svg'), wordmark(C.ink))
fs.writeFileSync(path.join(out, 'wordmark-dark.svg'), wordmark(C.paper))

// Open Graph image, 1200×630.
const contours = Array.from({ length: 9 }, (_, i) => {
  const r = 60 + i * 46
  return `<path d="M${980 - r} 300 C ${980 - r} ${300 - r * 0.9}, ${980 + r * 0.8} ${300 - r * 1.05}, ${980 + r} 290 S ${980 + r * 0.2} ${300 + r * 1.1}, ${980 - r} 300Z" fill="none" stroke="#2A2A2A" stroke-width="2"/>`
}).join('')
const stripes = Array.from({ length: 40 }, (_, i) => `<path d="M${i * 36 - 40} 630L${i * 36} 582H${i * 36 + 18}L${i * 36 - 22} 630Z" fill="${C.accent}"/>`).join('')
const ogName = text(display, 'RBAC Evolution', 400, 290, 96)
const ogScript = text(script, 'roles & permissions, cultivated.', 404, 380, 58)
const ogLine = text(jakarta, 'Node.js & Bun  ·  every framework  ·  every database', 406, 450, 26)
const og = svg(
  1200,
  630,
  `<rect width="1200" height="630" fill="${C.ink}"/>
  ${contours}
  ${stripes}
  <rect y="572" width="1200" height="10" fill="${C.ink}"/>
  <g transform="translate(70 150) scale(4.6)">${mark()}</g>
  <path d="${ogName.d}" fill="${C.paper}"/>
  <path d="${ogScript.d}" fill="${C.jade}"/>
  <path d="${ogLine.d}" fill="${C.grey}"/>
  <g fill="${C.accent}"><path d="M40 40H96V46H46V96H40Z"/><path d="M1160 40H1104V46H1154V96H1160Z"/></g>`,
)
sharp(Buffer.from(og))
  .png()
  .toFile(path.join(out, 'og-image.png'))
  .then(() => sharp(Buffer.from(svg(64, 64, `<rect width="64" height="64" fill="${C.ink}"/><g transform="translate(6 6) scale(0.8125)">${mark()}</g>`))).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png')))
  .then(() => console.log('ok'))
