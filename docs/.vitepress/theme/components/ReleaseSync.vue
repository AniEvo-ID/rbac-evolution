<script setup lang="ts">
/** Renders docs/public/reports/release.json, written by scripts/verify-release.mjs. */
import { withBase } from 'vitepress'
import { computed, onMounted, ref } from 'vue'

interface Row {
  name: string
  version: string
  npm: boolean
  provenance: boolean
  /** `latest`, or the prerelease's tag (`rc` for `1.0.0-rc.0`). Missing in older reports. */
  distTag?: string
  latest: string | null
  tag: boolean
  release: boolean | null
  ok: boolean
}
interface ReleaseReport {
  generatedAt: string
  runUrl: string | null
  ok: boolean
  packages: Row[]
}

const report = ref<ReleaseReport | null>(null)
const state = ref<'loading' | 'ready' | 'missing'>('loading')

onMounted(async () => {
  try {
    const res = await fetch(withBase('/reports/release.json'), { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    report.value = (await res.json()) as ReleaseReport
    state.value = 'ready'
  } catch {
    state.value = 'missing'
  }
})

const repo = 'https://github.com/AniEvo-ID/rbac-evolution'
const short = (name: string) => name.replace('@anievo-id/rbac-evolution-', '').replace('@anievo-id/rbac-evolution', 'core')
const mark = (v: boolean | null) => (v === null ? '–' : v ? '✓' : '✗')
const when = computed(() => (report.value ? new Date(report.value.generatedAt).toLocaleString() : ''))
</script>

<template>
  <div class="sync">
    <p v-if="state === 'loading'" class="note">Loading the release check…</p>
    <p v-else-if="state === 'missing'" class="note">No release check has been published yet.</p>
    <template v-else-if="report">
      <div class="status" :class="report.ok ? 'pass' : 'fail'">
        <span class="badge">{{ report.ok ? 'GITHUB ↔ NPM IN SYNC' : 'OUT OF SYNC' }}</span>
        <span>
          Checked {{ when }}<template v-if="report.runUrl"> · <a :href="report.runUrl">CI run</a></template>
        </span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Version</th>
              <th>On npm</th>
              <th>Provenance</th>
              <th>npm dist-tag</th>
              <th>Git tag</th>
              <th>GitHub Release</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in report.packages" :key="p.name" :class="{ bad: !p.ok }">
              <td><a :href="`https://www.npmjs.com/package/${p.name}`">{{ short(p.name) }}</a></td>
              <td>{{ p.version }}</td>
              <td :class="{ no: !p.npm }">{{ mark(p.npm) }}</td>
              <td :class="{ no: !p.provenance }">{{ mark(p.provenance) }}</td>
              <td :class="{ no: p.latest !== p.version }">{{ p.distTag ?? 'latest' }}: {{ p.latest ?? '–' }}</td>
              <td :class="{ no: !p.tag }">{{ mark(p.tag) }}</td>
              <td :class="{ no: p.release === false }">
                <a v-if="p.release" :href="`${repo}/releases/tag/${encodeURIComponent(`${p.name}@${p.version}`)}`">✓</a>
                <template v-else>{{ mark(p.release) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 14px;
}
.badge {
  font-family: var(--sect-font-label);
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 3px 10px;
  border-radius: 999px;
}
.pass .badge {
  color: #04251c;
  background: var(--sect-jade);
}
.fail .badge {
  color: #fff;
  background: var(--sect-signal);
}
.table-wrap {
  overflow-x: auto;
}
table {
  display: table;
  width: 100%;
}
td {
  white-space: nowrap;
  color: var(--sect-jade);
}
td:first-child,
td:nth-child(2) {
  color: var(--vp-c-text-1);
}
td.no {
  color: var(--sect-signal);
  font-weight: 700;
}
.note {
  font-size: 14px;
  color: var(--vp-c-text-2);
}
</style>
