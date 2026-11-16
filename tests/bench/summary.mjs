#!/usr/bin/env node
// Turns `vitest bench --outputJson <file>` into a Markdown table (the Benchmarks workflow appends it to the job summary).
//   node summary.mjs bench.json
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node summary.mjs <vitest bench --outputJson file>')
  process.exit(2)
}
const { files } = JSON.parse(readFileSync(file, 'utf8'))
const ms = (v) => (v < 0.1 ? `${(v * 1000).toFixed(1)} µs` : `${v.toFixed(2)} ms`)
const lines = ['| Group | Benchmark | ops/s | mean | p99 | samples |', '| --- | --- | ---: | ---: | ---: | ---: |']
for (const { groups } of files) {
  for (const { fullName, benchmarks } of groups) {
    const group = fullName.split(' > ').slice(1).join(' > ')
    for (const b of benchmarks) {
      lines.push(`| ${group} | ${b.name} | ${Math.round(b.hz).toLocaleString('en')} | ${ms(b.mean)} | ${ms(b.p99)} | ${b.sampleCount} |`)
    }
  }
}
console.log(lines.join('\n'))
