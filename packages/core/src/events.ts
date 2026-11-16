import type { Permission, Role, Subject, TeamId } from './types'

/**
 * Who made a change, for audit logs: usually the signed-in user as a subject (`{ type: 'user', id: 7 }`), or a
 * label such as `'system'` or `'cli'`. Set it per call (`rbac.for(user, { actor })`) or for the whole engine
 * (`createRbac({ getActor })`). Events carry it as `actor` when it is known.
 */
export type RbacActor = Subject | string

/** Write options that record who made the change. */
export interface ActorOptions {
  /** Who makes the change. Events carry it as `actor`. Default: `getActor()` of the engine, if set. */
  actor?: RbacActor | undefined
}

/** Fields every event payload has besides its own. */
export interface RbacEventBase {
  /**
   * Who made the change: the `actor` write option, or else what the engine's `getActor` returned.
   * Absent when neither gave one.
   */
  actor?: RbacActor | undefined
}

/** Roles were attached to a subject (`assignRole`, `syncRoles`). Only newly attached roles are listed. */
export interface RoleAttachedEvent extends RbacEventBase {
  event: 'role.attached'
  subject: Subject
  roles: Role[]
  guardName: string
  teamId: TeamId
}

/** Roles were detached from a subject (`removeRole`, `syncRoles`). Only actually removed roles are listed. */
export interface RoleDetachedEvent extends RbacEventBase {
  event: 'role.detached'
  subject: Subject
  roles: Role[]
  guardName: string
  teamId: TeamId
}

/** Who received / lost the permissions: a subject (direct permissions) or a role. */
export type PermissionTarget = { target: 'subject'; subject: Subject } | { target: 'role'; role: Role }

/** Permissions were attached to a subject or a role. Only newly attached permissions are listed. */
export type PermissionAttachedEvent = {
  event: 'permission.attached'
  permissions: Permission[]
  guardName: string
  /** The subject's team scope, or the role's `teamId`. */
  teamId: TeamId
} & PermissionTarget &
  RbacEventBase

/** Permissions were detached from a subject or a role. Only actually removed permissions are listed. */
export type PermissionDetachedEvent = {
  event: 'permission.detached'
  permissions: Permission[]
  guardName: string
  /** The subject's team scope, or the role's `teamId`. */
  teamId: TeamId
} & PermissionTarget &
  RbacEventBase

export interface RoleCreatedEvent extends RbacEventBase {
  event: 'role.created'
  role: Role
  teamId: TeamId
}

export interface RoleDeletedEvent extends RbacEventBase {
  event: 'role.deleted'
  role: Role
  teamId: TeamId
}

export interface PermissionCreatedEvent extends RbacEventBase {
  event: 'permission.created'
  permission: Permission
}

export interface PermissionDeletedEvent extends RbacEventBase {
  event: 'permission.deleted'
  permission: Permission
}

/** Every event emitted by `Rbac`, keyed by name. */
export interface RbacEventMap {
  'role.attached': RoleAttachedEvent
  'role.detached': RoleDetachedEvent
  'permission.attached': PermissionAttachedEvent
  'permission.detached': PermissionDetachedEvent
  'role.created': RoleCreatedEvent
  'role.deleted': RoleDeletedEvent
  'permission.created': PermissionCreatedEvent
  'permission.deleted': PermissionDeletedEvent
}

export type RbacEventName = keyof RbacEventMap

/** Union of every event payload, discriminated by `event`. */
export type RbacEvent = RbacEventMap[RbacEventName]

export type RbacEventListener<K extends RbacEventName = RbacEventName> = (
  payload: RbacEventMap[K],
) => void | Promise<void>

type AnyListener = (payload: never) => void | Promise<void>

/** Returns who makes the current change, see {@link RbacActor}. */
export type ActorResolver = () => RbacActor | null | undefined | Promise<RbacActor | null | undefined>

/** @internal Minimal ordered async event emitter. */
export class RbacEmitter {
  readonly #listeners = new Map<RbacEventName, Set<AnyListener>>()
  readonly #getActor: ActorResolver | undefined

  constructor(getActor?: ActorResolver) {
    this.#getActor = getActor
  }

  on<K extends RbacEventName>(event: K, listener: RbacEventListener<K>): () => void {
    let set = this.#listeners.get(event)
    if (!set) {
      set = new Set()
      this.#listeners.set(event, set)
    }
    set.add(listener)
    return () => this.off(event, listener)
  }

  off<K extends RbacEventName>(event: K, listener: RbacEventListener<K>): void {
    this.#listeners.get(event)?.delete(listener)
  }

  has(event: RbacEventName): boolean {
    return (this.#listeners.get(event)?.size ?? 0) > 0
  }

  /**
   * Calls the listeners one by one, in registration order, awaiting each. `actor` (else `getActor()`) is added
   * to the payload when known; `getActor` only runs when the event has listeners.
   */
  async emit<K extends RbacEventName>(payload: RbacEventMap[K] & { event: K }, actor?: RbacActor): Promise<void> {
    const set = this.#listeners.get(payload.event)
    if (!set || set.size === 0) return
    const who = actor ?? (await this.#getActor?.()) ?? undefined
    const full = who === undefined ? payload : { ...payload, actor: who }
    for (const listener of [...set]) {
      await (listener as RbacEventListener<K>)(full)
    }
  }
}
