declare const rbac: Rbac
/** The app's own entity. */
declare class User {
  id: number
  email: string
}
declare const dataSource: import('typeorm').DataSource
