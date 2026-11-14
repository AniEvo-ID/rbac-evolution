// Writes docs/public/reports/e2e.json for the docs "Test report" page.
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

interface Row {
  project: string
  title: string
  status: TestResult['status']
  durationMs: number
}

export default class SummaryReporter implements Reporter {
  private rows = new Map<string, Row>()

  onTestEnd(test: TestCase, result: TestResult) {
    // With retries, the last attempt wins.
    this.rows.set(test.id, {
      project: test.parent.project()?.name ?? '',
      title: test.titlePath().slice(3).join(' › '),
      status: result.status,
      durationMs: result.duration,
    })
  }

  onEnd(result: FullResult) {
    const rows = [...this.rows.values()]
    const count = (s: Row['status']) => rows.filter((r) => r.status === s).length
    const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_SHA: sha } = process.env
    const out = join(import.meta.dirname, '../../docs/public/reports')
    mkdirSync(out, { recursive: true })
    writeFileSync(
      join(out, 'e2e.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          commit: sha ?? execSync('git rev-parse HEAD').toString().trim(),
          runUrl: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null,
          ok: result.status === 'passed',
          totals: { total: rows.length, passed: count('passed'), failed: count('failed') + count('timedOut'), skipped: count('skipped') },
          tests: rows,
        },
        null,
        2,
      )}\n`,
    )
  }
}
