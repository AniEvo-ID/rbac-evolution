'use client'

import { useState, useTransition } from 'react'
import { Can, Cannot } from '@anievo-id/rbac-evolution-react'
import { type ActionResult, deleteArticle, publishArticle } from './actions'

function useAction() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const run = (action: () => Promise<ActionResult>) => startTransition(async () => setResult(await action()))
  return { pending, result, run }
}

function ResultMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null
  return result.ok ? <span className="ok">{result.message}</span> : <span className="error">{result.error}</span>
}

/** Buttons for one article. Each button is only rendered when the snapshot allows it. */
export function ArticleActions({ id, published }: { id: number; published: boolean }) {
  const { pending, result, run } = useAction()

  return (
    <div className="row">
      {!published && (
        <Can permission="publish articles">
          <button disabled={pending} onClick={() => run(() => publishArticle(id))}>
            Publish
          </button>
        </Can>
      )}
      <Can permission="delete articles">
        <button disabled={pending} onClick={() => run(() => deleteArticle(id))}>
          Delete
        </button>
      </Can>
      <Cannot permission="edit articles">
        <span className="muted">read only</span>
      </Cannot>
      <ResultMessage result={result} />
    </div>
  )
}

/**
 * Calls the delete action without any <Can> check, to show that the server
 * refuses on its own when the user lacks `delete articles`.
 */
export function BypassDemo({ id }: { id: number }) {
  const { pending, result, run } = useAction()

  return (
    <div className="card">
      <strong>Bypass the UI</strong>
      <p className="muted">
        This button is always visible. It calls the <code>deleteArticle</code> server action directly, so you can
        see <code>withPermission()</code> reject users without <code>delete articles</code>.
      </p>
      <div className="row">
        <button disabled={pending} onClick={() => run(() => deleteArticle(id))}>
          Try to delete article #{id}
        </button>
        <ResultMessage result={result} />
      </div>
    </div>
  )
}
