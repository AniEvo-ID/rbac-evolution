<!-- Stands in for a root +layout.svelte: the snapshot comes from `data`, so it is a prop here. -->
<script lang="ts">
  import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
  import { setRbacContext } from '../../src/index.js'
  import Page from './Page.svelte'

  let { data }: { data: { rbac: RbacSnapshot | null } } = $props()

  setRbacContext(() => data.rbac, { superAdminRoles: ['super-admin'], wildcard: true })
</script>

<Page />
