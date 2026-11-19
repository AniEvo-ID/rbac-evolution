/** Solid's renderer: `solid-js/web` in 1.x, `@solidjs/web` in 2.x. Untyped, so one test file runs on both. */
interface Web {
  render(code: () => unknown, element: Element): () => void
  renderToString(code: () => unknown): string
}

const candidates = ['solid-js/web', '@solidjs/web']

export async function loadWeb(): Promise<Web> {
  for (const name of candidates) {
    try {
      return (await import(/* @vite-ignore */ name)) as Web
    } catch {
      // try the next one
    }
  }
  throw new Error('neither solid-js/web nor @solidjs/web is installed')
}
