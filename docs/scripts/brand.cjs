// Generates the rbac-evolution brand SVGs (mark, favicon, wordmark) + og image.
// Usage (repo root): node docs/scripts/brand.cjs docs/public/brand "$PWD/node_modules/.pnpm/sharp@<version>/node_modules/sharp"
const fs = require('fs')
const path = require('path')
const sharp = require(process.argv[3])
const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })

const pt = (deg, r = 26, c = 32) => {
  const a = (deg * Math.PI) / 180
  return [+(c + r * Math.cos(a)).toFixed(2), +(c + r * Math.sin(a)).toFixed(2)]
}
const hex = [30, 90, 150, 210, 270, 330].map((d) => pt(d, 16.5))

function mark({ jade, gold, ink, grid, bg }) {
  const [sx, sy] = pt(112)
  const [ex, ey] = pt(298)
  const [gx1, gy1] = pt(322)
  const [gx2, gy2] = pt(68)
  // Arrowhead at the end of the jade arc, pointing clockwise.
  const t = [-Math.sin((298 * Math.PI) / 180), Math.cos((298 * Math.PI) / 180)]
  const n = [Math.cos((298 * Math.PI) / 180), Math.sin((298 * Math.PI) / 180)]
  const tip = [ex + 5 * t[0], ey + 5 * t[1]]
  const b = [ex - 1.2 * t[0], ey - 1.2 * t[1]]
  const a1 = [b[0] + 4.2 * n[0], b[1] + 4.2 * n[1]]
  const a2 = [b[0] - 4.2 * n[0], b[1] - 4.2 * n[1]]
  const f = (p) => p.map((v) => v.toFixed(2)).join(' ')
  return `
  ${bg ? `<circle cx="32" cy="32" r="31" fill="${bg}"/>` : ''}
  <circle cx="32" cy="32" r="21" fill="${ink}" stroke="${grid}" stroke-width="0.8"/>
  <g stroke="${grid}" stroke-width="0.6">${[24, 28, 32, 36, 40].map((y) => `<line x1="13" y1="${y}" x2="51" y2="${y}" opacity="0.5"/>`).join('')}</g>
  <polygon points="${hex.map(f).join(' ')}" fill="none" stroke="${jade}" stroke-width="1.4" stroke-linejoin="round"/>
  <g stroke="${jade}" stroke-width="0.8" opacity="0.7">${hex.map(([x, y]) => `<line x1="32" y1="32" x2="${x}" y2="${y}"/>`).join('')}</g>
  <g fill="${jade}">${hex.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>
  <path d="M${sx} ${sy} A26 26 0 1 1 ${ex} ${ey}" fill="none" stroke="${jade}" stroke-width="4" stroke-linecap="round"/>
  <polygon points="${f(tip)} ${f(a1)} ${f(a2)}" fill="${jade}" stroke="${jade}" stroke-width="1" stroke-linejoin="round"/>
  <path d="M${gx1} ${gy1} A26 26 0 0 1 ${gx2} ${gy2}" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round"/>
  <rect x="29.4" y="55.4" width="5.2" height="5.2" transform="rotate(45 32 58)" fill="${gold}"/>
  <g fill="none" stroke="${gold}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="23.5" r="5.2"/>
    <path d="M32 28.7V46.5M32 41.5h4.6M32 45.6h3.4"/>
  </g>
  <circle cx="32" cy="23.5" r="1.6" fill="${jade}"/>`
}

const dark = { jade: '#34d3a6', gold: '#e7b75f', ink: '#0b1020', grid: '#1d3b44' }
const light = { jade: '#0b7f62', gold: '#b07a1f', ink: '#f2efe4', grid: '#cfe3da' }
const svg = (body, w = 64, h = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}\n</svg>\n`

fs.writeFileSync(path.join(out, 'mark-dark.svg'), svg(mark(dark)))
fs.writeFileSync(path.join(out, 'mark-light.svg'), svg(mark(light)))
fs.writeFileSync(path.join(out, 'favicon.svg'), svg(mark({ ...dark, bg: '#0b1020' })))

// Wordmark for README / social: mark + "rbac" outline + "evolution" bold + tagline.
function wordmark(c, textFill) {
  return svg(
    `<g transform="translate(8 8) scale(1.5)">${mark(c)}</g>
  <text x="118" y="70" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif" font-size="52" font-weight="300" fill="none" stroke="${c.gold}" stroke-width="1.6" letter-spacing="1">rbac</text>
  <text x="232" y="70" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif" font-size="52" font-weight="700" fill="${c.jade}">evolution</text>
  <text x="120" y="96" font-family="'JetBrains Mono',Menlo,monospace" font-size="12" letter-spacing="4.2" fill="${textFill}">ROLES · PERMISSIONS · CULTIVATED</text>
  <line x1="120" y1="106" x2="470" y2="106" stroke="${c.jade}" stroke-width="1" opacity="0.5"/>
  <rect x="472" y="103" width="6" height="6" transform="rotate(45 475 106)" fill="${c.gold}"/>`,
    500,
    112,
  )
}
fs.writeFileSync(path.join(out, 'wordmark-dark.svg'), wordmark(dark, '#a8b3c7'))
fs.writeFileSync(path.join(out, 'wordmark-light.svg'), wordmark(light, '#4b5563'))

// Open Graph image 1200x630.
const og = svg(
  `<defs>
    <radialGradient id="g" cx="0.28" cy="0.5" r="0.7"><stop offset="0" stop-color="#123a3a"/><stop offset="1" stop-color="#0b1020"/></radialGradient>
    <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1b3340" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="url(#p)" opacity="0.6"/>
  <path d="M0 560 L140 470 L240 520 L380 430 L520 540 L680 460 L820 530 L980 450 L1200 540 V630 H0Z" fill="#0f1a2a" opacity="0.9"/>
  <g transform="translate(90 155) scale(5)">${mark(dark)}</g>
  <text x="470" y="290" font-family="'Helvetica Neue',Arial,sans-serif" font-size="92" font-weight="300" fill="none" stroke="#e7b75f" stroke-width="2.5">rbac</text>
  <text x="470" y="390" font-family="'Helvetica Neue',Arial,sans-serif" font-size="104" font-weight="700" fill="#34d3a6">evolution</text>
  <text x="474" y="450" font-family="Menlo,monospace" font-size="24" letter-spacing="6" fill="#a8b3c7">ROLES · PERMISSIONS · CULTIVATED</text>
  <text x="474" y="510" font-family="'Helvetica Neue',Arial,sans-serif" font-size="25" fill="#d6dbe6">Node.js &amp; Bun · every framework · every database</text>
  <g stroke="#34d3a6" stroke-width="3" fill="none"><path d="M30 70V30H70"/><path d="M1130 30H1170V70"/><path d="M30 560V600H70"/><path d="M1130 600H1170V560"/></g>`,
  1200,
  630,
)
fs.writeFileSync(path.join(out, 'og-src.svg'), og)
sharp(Buffer.from(og))
  .png()
  .toFile(path.join(out, 'og-image.png'))
  .then(() => sharp(Buffer.from(svg(mark({ ...dark, bg: '#0b1020' })))).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png')))
  .then(() => {
    fs.unlinkSync(path.join(out, 'og-src.svg'))
    console.log('ok')
  })
