import type { Permission, Role, Subject, TeamId } from './types'

/** Roles were attached to a subject (`assignRole`, `syncRoles`). Only newly attached roles are listed. */
export interface RoleAttachedEvent {
  event: 'role.attached'
  subject: Subject
  roles: Role[]
  guardName: string
  teamId: TeamId
}

/** Roles were detached from a subject (`removeRole`, `syncRoles`). Only actually removed roles are listed. */
export interface RoleDetachedEvent {
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
} & PermissionTarget

/** Permissions were detached from a subject or a role. Only actually removed permissions are listed. */
export type PermissionDetachedEvent = {
  event: 'permission.detached'
  permissions: Permission[]
  guardName: string
  /** The subject's team scope, or the role's `teamId`. */
  teamId: TeamId
} & PermissionTarget

export interface RoleCreatedEvent {
  event: 'role.created'
  role: Role
  teamId: TeamId
}

export interface RoleDeletedEvent {
  event: 'role.deleted'
  role: Role
  teamId: TeamId
}

export interface PermissionCreatedEvent {
  event: 'permission.created'
  permission: Permission
}

export interface PermissionDeletedEvent {
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

/** @internal Minimal ordered async event emitter. */
export class RbacEmitter {
  readonly #listeners = new Map<RbacEventName, Set<AnyListener>>()

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

  /** Calls the listeners one by one, in registration order, awaiting each. */
  async emit<K extends RbacEventName>(payload: RbacEventMap[K] & { event: K }): Promise<void> {
    const set = this.#listeners.get(payload.event)
    if (!set || set.size === 0) return
    for (const listener of [...set]) {
      await (listener as RbacEventListener<K>)(payload)
    }
  }
}
