<!--
  @component
  Renders `children` when the user has the role(s), otherwise the `fallback` snippet.
  Conditions are ANDed; without any condition nothing passes (deny by default). `not` inverts the result.

  ```svelte
  <HasRole role="admin">...</HasRole>
  <HasRole role="writer|editor">...</HasRole>
  <HasRole allOf={['writer', 'editor']}>...</HasRole>
  ```
-->
<script lang="ts">
  import { getRbacContext } from './context.svelte.js'
  import type { HasRoleProps } from './props.js'

  let { role, anyOf, allOf, not = false, children, fallback }: HasRoleProps = $props()

  const rbac = getRbacContext()

  const hasCondition = $derived(role !== undefined || anyOf !== undefined || allOf !== undefined)
  const allowed = $derived(
    (role === undefined || rbac.hasAnyRole(role)) &&
      (anyOf === undefined || rbac.hasAnyRole(anyOf)) &&
      (allOf === undefined || rbac.hasAllRoles(allOf)),
  )
  const pass = $derived(hasCondition && allowed !== not)
</script>

{#if pass}
  {@render children?.()}
{:else}
  {@render fallback?.()}
{/if}
