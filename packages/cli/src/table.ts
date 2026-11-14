/** Renders a simple box table, like Laravel's console tables. */
export function renderTable(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = head.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i] ?? ''))))
  const line = (l: string, m: string, r: string): string => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r
  const row = (cells: readonly string[]): string =>
    '│' + widths.map((w, i) => ` ${pad(cells[i] ?? '', w)} `).join('│') + '│'

  return [line('┌', '┬', '┐'), row(head), line('├', '┼', '┤'), ...rows.map(row), line('└', '┴', '┘')].join('\n')
}

function width(text: string): number {
  return [...text].length
}

function pad(text: string, w: number): string {
  return text + ' '.repeat(w - width(text))
}
