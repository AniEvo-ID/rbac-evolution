import { prisma } from '@/lib/prisma'
import { can, requirePermission } from '@/lib/rbac'
import { ArticleActions, BypassDemo } from './article-actions'
import { NewArticleForm } from './new-article-form'

export default async function ArticlesPage() {
  // Guests are redirected to /login, users without the permission to /forbidden.
  await requirePermission('view articles')

  // Server-side check: only users who can publish see drafts.
  const showDrafts = await can('publish articles')
  const articles = await prisma.article.findMany({
    where: showDrafts ? {} : { published: true },
    include: { author: true },
    orderBy: { id: 'asc' },
  })

  return (
    <>
      <h1>Articles</h1>
      <NewArticleForm />
      {articles.length === 0 && <p className="muted">No articles.</p>}
      {articles.map((article) => (
        <div key={article.id} className="card">
          <div className="row">
            <strong>
              #{article.id} {article.title}
            </strong>
            {!article.published && <em className="muted">(draft)</em>}
            <span className="muted" style={{ marginLeft: 'auto' }}>
              by {article.author.name}
            </span>
          </div>
          <p>{article.body}</p>
          <ArticleActions id={article.id} published={article.published} />
        </div>
      ))}
      {articles[0] && <BypassDemo id={articles[0].id} />}
    </>
  )
}
