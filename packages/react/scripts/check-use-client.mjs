// Fails the build if a bundled entry does not start with the `'use client'` directive.
import { readFileSync } from 'node:fs'

const files = ['dist/index.js', 'dist/index.cjs']
for (const file of files) {
  const first = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n', 1)[0]?.trim()
  if (first !== "'use client'" && first !== "'use client';" && first !== '"use client";' && first !== '"use client"') {
    console.error(`${file} does not start with 'use client' (got: ${first})`)
    process.exit(1)
  }
}
console.log(`'use client' directive present in ${files.join(', ')}`)
