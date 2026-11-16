// Stub: a copy of the `src/seed.ts` block of docs/use-cases/ecommerce-admin.md.
import type { SyncDefinition } from '@anievo-id/rbac-evolution'
import type { ShopRbac } from './rbac'

export const shopSeed = {
  roles: {
    warehouse: ['orders.view', 'orders.ship', 'products.view', 'inventory.*'],
    cashier: ['orders.view', 'orders.create', 'orders.discount', 'products.view', 'customers.view'],
    support: ['orders.view', 'orders.cancel', 'orders.refund.small', 'customers.*'],
    manager: ['orders.*', 'products.*', 'inventory.*', 'customers.*', 'reports.*', 'staff.manage'],
  },
} satisfies SyncDefinition<ShopRbac>
