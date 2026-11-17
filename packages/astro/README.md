# @anievo-id/rbac-evolution-astro

[Astro](https://astro.build) 4 to 7 guards for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution):
permission and role checks in pages, endpoints and middleware, and a snapshot for client islands.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-astro
```

## Usage

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-astro'

export const rbac = createRbac({ adapter })
export const rbacServer = createRbacServer({
  rbac,
  getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
  unauthenticatedRedirect: '/login',
})
```

```astro
---
// src/pages/admin.astro
import { rbacServer } from '../rbac'

const denied = await rbacServer.requireRole(Astro, 'admin') // a 401/403 Response or a redirect
if (denied) return denied
---
```

- A failed guard resolves to a standard `Response`: 401 / 403 with the same JSON body as the other integrations, or
  a 302 with `unauthenticatedRedirect` / `forbiddenRedirect`. A passing guard resolves to `undefined`.
- The same guards work in endpoints (`APIRoute`) and in `src/middleware.ts`.
- No runtime import of Astro. Pages that use the guards must be rendered on demand.
- A typed engine (`createRbac<AppRbac>()`) types the names of every guard.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/astro

## License

MIT
