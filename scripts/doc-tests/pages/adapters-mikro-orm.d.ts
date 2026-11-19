declare const rbac: Rbac
declare const orm: import('@mikro-orm/postgresql').MikroORM
/** The app's own entity. */
declare class User {
  id: number
  email: string
}
