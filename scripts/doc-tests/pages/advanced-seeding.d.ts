declare const rbac: Rbac
declare const adapter: RbacAdapter
/** A definition like the one of "Defining roles & permissions". */
declare const definition: SyncDefinition | readonly SyncDefinition[]
/** "when you provision a new tenant" */
declare const teamTemplate: SyncDefinition | readonly SyncDefinition[]
declare const newTeam: { id: number }
/** The app's typed names (see Typed names). */
type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }
