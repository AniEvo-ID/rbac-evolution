<!--
  @component
  Renders `children` when the user has the permission(s), otherwise the `fallback` snippet.
  Conditions are ANDed; without any condition nothing passes (deny by default). `not` inverts the result.

  ```svelte
  <Can permission="articles.edit">...</Can>
  <Can anyOf={['articles.edit', 'articles.delete']}>
    ...
    {#snippet fallback()}No access{/snippet}
  </Can>
  <Can allOf={['a', 'b']}>...</Can>
  ```
-->
<script lang="ts">
  import { getRbacContext } from './context.svelte.js'
  import type { CanProps } from './props.js'

  let { permission, anyOf, allOf, not = false, children, fallback }: CanProps = $props()

  const rbac = getRbacContext()

  const hasCondition = $derived(permission !== undefined || anyOf !== undefined || allOf !== undefined)
  const allowed = $derived(
    (permission === undefined || rbac.canAll(permission)) &&
      (anyOf === undefined || rbac.canAny(anyOf)) &&
      (allOf === undefined || rbac.canAll(allOf)),
  )
  const pass = $derived(hasCondition && allowed !== not)
</script>

{#if pass}
  {@render children?.()}
{:else}
  {@render fallback?.()}
{/if}
