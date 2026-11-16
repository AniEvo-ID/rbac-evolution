// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/ecommerce-admin.md.
import { createRbac, type SubjectRbac } from '@anievo-id/rbac-evolution'
import { createRbacDecorators } from '@anievo-id/rbac-evolution-nestjs'
import { adapter } from './db' // e.g. new PrismaAdapter(prisma), see Adapters

const roles = ['warehouse', 'cashier', 'support', 'manager'] as const

type Resource = 'orders' | 'products' | 'inventory' | 'customers' | 'reports' | 'staff'

export type ShopRbac = {
  permissions:
    | `${Resource}.*`
    | 'orders.view'
    | 'orders.create'
    | 'orders.discount'
    | 'orders.ship'
    | 'orders.cancel'
    | 'orders.refund.small'
    | 'orders.refund.large'
    | 'products.view'
    | 'products.edit'
    | 'products.price'
    | 'inventory.view'
    | 'inventory.adjust'
    | 'customers.view'
    | 'customers.edit'
    | 'reports.view'
    | 'reports.export'
    | 'staff.manage'
  roles: (typeof roles)[number]
}

export const rbac = createRbac<ShopRbac>({ adapter, wildcard: true, names: { roles } })

export const { RequirePermissions, CanAny } = createRbacDecorators<typeof rbac>()

/** What `@CurrentRbac()` injects, with the shop's names: a typo in a check is a compile error. */
export type Access = SubjectRbac<ShopRbac>
