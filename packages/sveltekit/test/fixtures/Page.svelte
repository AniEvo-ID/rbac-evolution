<!-- A page below the layout: reads the context and uses the components. -->
<script lang="ts">
  import { Can, getRbacContext, HasRole } from '../../src/index.js'

  const rbac = getRbacContext()
  const canPublish = $derived(rbac.can('articles.publish'))
</script>

<p data-testid="status">{rbac.isGuest ? 'guest' : 'user'}</p>
<p data-testid="can-publish">{canPublish}</p>

<Can permission="articles.edit">
  <p data-testid="edit">edit</p>
  {#snippet fallback()}
    <p data-testid="edit-fallback">no edit</p>
  {/snippet}
</Can>

<Can anyOf={['articles.delete', 'articles.publish']}><p data-testid="any">any</p></Can>
<Can allOf={['articles.edit', 'articles.publish']}><p data-testid="all">all</p></Can>
<Can permission="articles.edit" not><p data-testid="not-edit">read only</p></Can>
<Can permission="billing.manage"><p data-testid="billing">billing</p></Can>
<Can><p data-testid="no-condition">never</p></Can>

<HasRole role="writer|editor"><p data-testid="staff">staff</p></HasRole>
<HasRole allOf={['writer', 'editor']}>
  <p data-testid="both">both</p>
  {#snippet fallback()}
    <p data-testid="both-fallback">not both</p>
  {/snippet}
</HasRole>
<HasRole anyOf={['admin']}><p data-testid="admin">admin</p></HasRole>
<HasRole role="admin" not><p data-testid="not-admin">not admin</p></HasRole>
<HasRole><p data-testid="no-role-condition">never</p></HasRole>
