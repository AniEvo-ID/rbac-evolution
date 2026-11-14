<script setup lang="ts">
/** Renders the Playwright E2E report (docs/public/reports/e2e.json, written by tests/e2e/summary-reporter.ts). */
import { withBase } from 'vitepress'
import { computed, onMounted, ref } from 'vue'

interface Row {
  project: string
  title: string
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
  durationMs: number
}
interface E2eReport {
  generatedAt: string
  commit: string
  runUrl: string | null
  ok: boolean
  totals: { total: number; passed: number; failed: number; skipped: number }
  tests: Row[]
}

const LABELS: Record<string, string> = {
  'vue-express': 'Vue 3 + Express + Drizzle (SQLite)',
  'next-prisma': 'Next.js App Router + Prisma (SQLite)',
  docs: 'This docs site',
}

const report = ref<E2eReport | null>(null)
const state = ref<'loading' | 'ready' | 'missing'>('loading')

onMounted(async () => {
  try {
    const res = await fetch(withBase('/reports/e2e.json'), { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    report.value = (await res.json()) as E2eReport
    state.value = 'ready'
  } catch {
    state.value = 'missing'
  }
})

const groups = computed(() => {
  const map = new Map<string, Row[]>()
  for (const t of report.value?.tests ?? []) map.set(t.project, [...(map.get(t.project) ?? []), t])
  return [...map.entries()].map(([project, tests]) => ({ project, label: LABELS[project] ?? project, tests }))
})
const when = computed(() => (report.value ? new Date(report.value.generatedAt).toLocaleString() : ''))
const icon = (s: Row['status']) => (s === 'passed' ? '✓' : s === 'skipped' ? '–' : '✗')
</script>

<template>
  <div class="e2e">
    <p v-if="state === 'loading'" class="note">Loading the latest E2E run…</p>
    <p v-else-if="state === 'missing'" class="note">No E2E report has been published yet.</p>
    <template v-else-if="report">
      <div class="status" :class="report.ok ? 'pass' : 'fail'">
        <span class="badge">{{ report.ok ? 'E2E PASSING' : 'E2E FAILURES' }}</span>
        <span>
          {{ report.totals.passed }}/{{ report.totals.total }} scenarios · commit
          <a :href="`https://github.com/AniEvo-ID/rbac-evolution/commit/${report.commit}`">{{ report.commit.slice(0, 7) }}</a>
          · {{ when }}
          <template v-if="report.runUrl"> · <a :href="report.runUrl">CI run</a></template>
        </span>
      </div>
      <section v-for="g in groups" :key="g.project" class="group">
        <h3>{{ g.label }}</h3>
        <ul>
          <li v-for="t in g.tests" :key="t.title" :class="t.status">
            <span class="icon" :aria-label="t.status">{{ icon(t.status) }}</span>
            <span class="title">{{ t.title }}</span>
            <span class="time">{{ t.durationMs }} ms</span>
          </li>
        </ul>
      </section>
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
.group h3 {
  margin: 20px 0 8px;
  font-size: 17px;
}
.group h3::before {
  display: none;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
}
li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  padding: 8px 14px;
  font-size: 14px;
  border-top: 1px solid var(--vp-c-divider);
}
li:first-child {
  border-top: 0;
}
.icon {
  width: 14px;
  font-weight: 700;
  color: var(--sect-jade);
}
li.failed .icon,
li.timedOut .icon,
li.interrupted .icon {
  color: var(--sect-signal);
}
li.skipped .icon {
  color: var(--vp-c-text-3);
}
.title {
  flex: 1;
  color: var(--vp-c-text-1);
}
.time {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.note {
  font-size: 14px;
  color: var(--vp-c-text-2);
}
</style>
