// Crops a round-avatar square (the face) out of each 2D mascot for the home page character select.
// Usage (repo root): SHARP=<path to sharp package> node docs/scripts/avatars.cjs [sheet.png]
// Crop boxes are fractions of the image: [left, top, size as a fraction of the width].
// shortcut: boxes are tuned by eye for the current art; re-tune them when a mascot is regenerated.
const path = require('path')
const sharp = require(process.env.SHARP)

const dir = path.join(__dirname, '../public/mascots')
const boxes = {
  'sect-master': [0.06, 0.1, 0.9],
  gatekeeper: [0.05, 0.05, 0.88],
  'scroll-keeper': [0.06, 0.04, 0.88],
  twins: [0.12, 0.05, 0.76],
  disciple: [0.08, 0.04, 0.84],
  weaver: [0.04, 0.05, 0.92],
  alchemist: [0.12, 0.04, 0.76],
  messenger: [0.16, 0.04, 0.64],
  'spirit-fox': [0.15, 0.04, 0.84],
}

async function main() {
  const tiles = []
  for (const [id, [l, t, s]] of Object.entries(boxes)) {
    const img = sharp(path.join(dir, `${id}.webp`))
    const { width, height } = await img.metadata()
    const size = Math.round(width * s)
    const left = Math.round(width * l)
    const top = Math.round(height * t)
    if (left + size > width || top + size > height) throw new Error(`${id}: crop box leaves the image`)
    const buf = await img.extract({ left, top, width: size, height: size }).resize(160, 160).webp({ quality: 88, alphaQuality: 90 }).toBuffer()
    await sharp(buf).toFile(path.join(dir, `${id}-avatar.webp`))
    tiles.push(buf)
  }
  const sheet = process.argv[2]
  if (sheet) {
    await sharp({ create: { width: 170 * tiles.length, height: 170, channels: 3, background: '#1c222b' } })
      .composite(tiles.map((input, i) => ({ input, left: i * 170 + 5, top: 5 })))
      .png()
      .toFile(sheet)
  }
  console.log('ok', tiles.length)
}
main()
