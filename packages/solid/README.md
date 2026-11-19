# @anievo-id/rbac-evolution-solid

[Solid](https://www.solidjs.com) bindings for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution):
`<Can>`, `<HasRole>` and `useCan()` accessors over a snapshot of the user's roles and permissions. Solid 1.8+ and 2.x,
in the browser and in server rendering.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-solid
```

## Usage

```tsx
import { Can, RbacProvider, useCan } from '@anievo-id/rbac-evolution-solid'

// snapshot: `await rbac.for(user).snapshot()` from the server, null for guests
<RbacProvider snapshot={snapshot()}>
  <Can permission="articles.edit" fallback={<p>Read only</p>}>
    <EditButton />
  </Can>
</RbacProvider>

const canPublish = useCan('articles.publish') // Accessor<boolean>
```

UI only: it decides what the page shows. Always check permissions on the server too.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/solid

## License

MIT
