// Stub: a copy of the `src/staff.service.ts` block of docs/use-cases/ecommerce-admin.md.
import { Inject, Injectable } from '@nestjs/common'
import type { Rbac, RoleName } from '@anievo-id/rbac-evolution'
import { RBAC } from '@anievo-id/rbac-evolution-nestjs'
import type { ShopRbac } from './rbac'

@Injectable()
export class StaffService {
  constructor(@Inject(RBAC) private readonly rbac: Rbac<ShopRbac>) {}

  /** A new hire, or a move to another job: exactly this one role. */
  async setJob(userId: number, role: RoleName<ShopRbac>) {
    await this.rbac.for({ type: 'user', id: userId }).syncRoles(role)
  }

  /** A cashier who also helps in the warehouse during the holiday rush. */
  async addJob(userId: number, role: RoleName<ShopRbac>) {
    await this.rbac.for({ type: 'user', id: userId }).assignRole(role)
  }

  /** Last day: no roles, no direct permissions. */
  async offboard(userId: number) {
    const staff = this.rbac.for({ type: 'user', id: userId })
    await staff.syncRoles([])
    await staff.syncPermissions([])
  }
}
