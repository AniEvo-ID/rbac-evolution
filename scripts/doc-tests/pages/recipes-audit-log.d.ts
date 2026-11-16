declare const rbac: Rbac
declare const app: import('express').Express
declare const auditContext: typeof import('../src/audit-context').auditContext
/** `names()` of `audit.ts`. */
declare const names: (items: { name: string }[]) => string[]
/** "your own notifier (Slack, e-mail, a pager)" */
declare const alerts: { send(message: string): Promise<void> }

// What the app's authentication puts on the request.
declare namespace Express {
  interface Request {
    user?: { id: number }
  }
}
