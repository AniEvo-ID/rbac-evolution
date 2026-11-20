declare const rbac: Rbac
/** The app's Better Auth database (an adapter or a pool). */
declare const database: any
declare const app: import('express').Express
declare const auth: ReturnType<typeof import('better-auth').betterAuth>
