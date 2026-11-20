# @anievo-id/rbac-evolution-better-auth

[Better Auth](https://www.better-auth.com) plugin for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution):
the signed-in user as an rbac subject, the user's snapshot for the UI, default roles on sign-up and cleanup when a
user is deleted.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-better-auth
```

## Usage

```ts
// server
import { betterAuth } from 'better-auth'
import { rbacPlugin, subjectFromSession } from '@anievo-id/rbac-evolution-better-auth'

export const auth = betterAuth({ database, plugins: [rbacPlugin({ rbac, defaultRoles: ['member'] })] })

// any integration: the request's session is the subject
createRbacServer({ rbac, getSubject: (request) => subjectFromSession(auth, request.headers) })
```

```ts
// client
import { createAuthClient } from 'better-auth/react'
import { rbacClient } from '@anievo-id/rbac-evolution-better-auth/client'

export const authClient = createAuthClient({ plugins: [rbacClient()] })
const { data: snapshot } = await authClient.rbac.snapshot() // for <RbacProvider>
```

## Documentation

https://creation.anievo.id/rbac-evolution/recipes/better-auth

## License

MIT
