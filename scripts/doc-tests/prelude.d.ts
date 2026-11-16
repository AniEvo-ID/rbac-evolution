// Doc tests (scripts/doc-tests.mjs): the free variables the guides use without declaring them, with
// the meaning they have throughout the docs. A page with its own prelude (pages/<page>.d.ts) uses that
// file instead of this one, so it can give a name another type (e.g. a typed `rbac`).

declare const rbac: Rbac
declare const adapter: RbacAdapter
/** The guides use `user` both as a subject (`rbac.for(user)`) and as its helper (`user.can(...)`). */
declare const user: Subject & SubjectRbac
