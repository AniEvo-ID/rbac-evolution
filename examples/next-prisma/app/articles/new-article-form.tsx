'use client'

import { useActionState } from 'react'
import { Can } from '@anievo-id/rbac-evolution-react'
import { createArticle } from './actions'

export function NewArticleForm() {
  const [result, formAction, pending] = useActionState(createArticle, null)

  return (
    <Can permission="create articles" fallback={<p className="muted">You can't write articles.</p>}>
      <form action={formAction} className="card">
        <strong>New article</strong>
        <div className="row">
          <input name="title" placeholder="Title" required />
          <input name="body" placeholder="Body" />
          <button type="submit" disabled={pending}>
            Create
          </button>
          {result && (result.ok ? <span className="ok">{result.message}</span> : <span className="error">{result.error}</span>)}
        </div>
      </form>
    </Can>
  )
}
