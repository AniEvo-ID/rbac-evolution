declare const adapter: RbacAdapter
declare const rbac: Rbac
/** A subject that has the super-admin role. */
declare const root: Subject
declare function isBanned(id: Id): Promise<boolean>
// The React and Vue tabs.
declare const RbacProvider: typeof import('@anievo-id/rbac-evolution-react').RbacProvider
declare const createRbacPlugin: typeof import('@anievo-id/rbac-evolution-vue').createRbacPlugin
declare const snapshot: RbacSnapshot
declare const children: import('react').ReactNode
