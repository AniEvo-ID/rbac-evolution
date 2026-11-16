# E-commerce back office

The staff side of an online shop, built with [NestJS](/frameworks/nestjs) and a [Vue](/frameworks/vue) admin UI.
It uses [wildcard permissions](/basic-usage/wildcard-permissions) (`orders.*`), so a manager's role stays short and
picks up new order actions without a seed change.

## The app

Customers never log in here. Staff do: they pack orders, take phone orders, answer support tickets and run the
shop. Every screen and every button depends on the job of the person using it.

| User | What they do |
| --- | --- |
| Warehouse | Sees orders to pack, marks them as shipped, counts and adjusts stock. |
| Cashier | Takes phone and in-store orders, applies discounts, looks up customers. |
| Support | Answers tickets: cancels orders, gives small refunds, edits customer details. |
| Manager | Runs the shop: everything above, plus products, prices, reports and staff. |

## Roles and permissions

Permissions follow `resource.action`. The table lists what each role **stores**; `*` covers every action of the
resource:

| Resource | warehouse | cashier | support | manager |
| --- | --- | --- | --- | --- |
| orders | `view`, `ship` | `view`, `create`, `discount` | `view`, `cancel`, `refund.small` | `orders.*` |
| products | `view` | `view` | | `products.*` |
| inventory | `inventory.*` | | | `inventory.*` |
| customers | | `view` | `customers.*` | `customers.*` |
| reports | | | | `reports.*` |
| staff | | | | `staff.manage` |

Why this split:

- **Wildcards for "the whole area".** A manager may do anything with orders, including actions you add next
  year. `orders.*` says that directly. The warehouse owns stock, so it gets `inventory.*` too.
- **Exact names for "just this".** A cashier may create orders but not cancel or refund them, so the cashier gets
  a list, not a wildcard.
- **Two refund permissions.** Support may refund up to $100. Bigger refunds need a manager. See
  [the shorter-name trap](#the-shorter-name-trap) for why these are `orders.refund.small` and
  `orders.refund.large`, not `orders.refund` and `orders.refund.large`.
- **Code checks actions, not jobs.** The controllers ask for `orders.ship`, never for `warehouse`. See
  [Roles vs permissions](/best-practices/roles-vs-permissions).

## Seed it

With wildcards on, the typed names must include the names you **check** as well as the ones you store. A template
literal type covers the `resource.*` names:

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacDecorators } from '@anievo-id/rbac-evolution-nestjs'
import { adapter } from './db' // e.g. new PrismaAdapter(prisma), see Adapters

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
  roles: 'warehouse' | 'cashier' | 'support' | 'manager'
}

export const rbac = createRbac<ShopRbac>({ adapter, wildcard: true })

export const { RequirePermissions, CanAny } = createRbacDecorators<ShopRbac>()
```

```ts
// src/seed.ts
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
```

Only stored names need to exist. `orders.refund.large` is never stored: the manager passes the check through
`orders.*`. With `wildcard: true`, `sync()` also validates the syntax, so `orders..ship` fails before anything is
written. Run it on deploy:

```ts
// scripts/seed.ts
import { rbac } from '../src/rbac'
import { shopSeed } from '../src/seed'

await rbac.sync(shopSeed)
```

## Assign roles

Managers hire and move staff from an admin screen. Inject the engine with the `RBAC` token:

```ts
// src/staff.service.ts
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
    await this.rbac.for({ type: 'user', id: userId }).revokeAll()
  }
}
```

```ts
// src/staff.controller.ts
import { Body, Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common'
import type { RoleName } from '@anievo-id/rbac-evolution'
import { RequirePermissions, type ShopRbac } from './rbac'
import { StaffService } from './staff.service'

@Controller('staff')
@RequirePermissions('staff.manage') // every route of this controller
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Put(':id/job')
  setJob(@Param('id', ParseIntPipe) id: number, @Body() body: { role: RoleName<ShopRbac> }) {
    return this.staff.setJob(id, body.role)
  }

  @Delete(':id')
  offboard(@Param('id', ParseIntPipe) id: number) {
    return this.staff.offboard(id)
  }
}
```

Validate `body.role` with a pipe or DTO in a real app. `syncRoles()` throws `RoleDoesNotExist` for an unknown role,
which Nest turns into a 500.

## Guard the routes

Register the module once, with the engine and a way to find the signed-in staff member:

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'
import { OrdersController } from './orders.controller'
import { rbac } from './rbac'
import { StaffController } from './staff.controller'
import { StaffService } from './staff.service'

@Module({
  imports: [
    RbacModule.forRoot({
      rbac,
      getSubject: (ctx) => {
        const user = ctx.switchToHttp().getRequest().user // set by your auth guard
        return user ? { type: 'user', id: user.id } : null
      },
    }),
  ],
  controllers: [OrdersController, StaffController],
  providers: [StaffService],
})
export class AppModule {}
```

The orders controller uses the typed decorators from `./rbac`. The refund route lets in anyone who can refund
*something*, then checks the amount:

```ts
// src/orders.controller.ts
import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common'
import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import { CurrentRbac } from '@anievo-id/rbac-evolution-nestjs'
import { canRefund } from './policies'
import { CanAny, RequirePermissions } from './rbac'

@Controller('orders')
export class OrdersController {
  @Get()
  @RequirePermissions('orders.view')
  list() {}

  @Post()
  @RequirePermissions('orders.create')
  create(@Body() body: { items: { sku: string; qty: number }[]; discountCode?: string }) {}

  @Post(':id/ship')
  @RequirePermissions('orders.ship')
  ship(@Param('id') id: string) {}

  @Post(':id/cancel')
  @RequirePermissions('orders.cancel')
  cancel(@Param('id') id: string) {}

  @Post(':id/refund')
  @CanAny('orders.refund.small', 'orders.refund.large')
  async refund(
    @Param('id') id: string,
    @Body() body: { amountCents: number },
    @CurrentRbac() access: SubjectRbac,
  ) {
    if (!(await canRefund(access, body.amountCents))) {
      throw new ForbiddenException('Refunds over $100 need a manager.')
    }
    // ...refund through the payment provider
  }
}
```

```ts
// src/policies.ts
import type { SubjectRbac } from '@anievo-id/rbac-evolution'

/** Refunds above this amount need `orders.refund.large`. */
export const LARGE_REFUND_CENTS = 100_00

export async function canRefund(access: SubjectRbac, amountCents: number): Promise<boolean> {
  return access.can(amountCents > LARGE_REFUND_CENTS ? 'orders.refund.large' : 'orders.refund.small')
}
```

A cashier who calls `POST /orders/1/refund` gets the standard 403 from `@CanAny`. A support agent asking for $250
gets the `ForbiddenException` from the handler.

### The Vue side

The admin UI fetches the snapshot from an endpoint:

```ts
// src/me.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common'
import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import { CurrentRbac, RbacGuard } from '@anievo-id/rbac-evolution-nestjs'

@Controller('me')
export class MeController {
  @Get('permissions')
  @UseGuards(RbacGuard)
  permissions(@CurrentRbac() access: SubjectRbac | null) {
    return access ? access.snapshot() : null
  }
}
```

The snapshot holds the **stored** names, such as `orders.*`. Turn `wildcard` on in the plugin too, or a manager's
`v-can="'orders.ship'"` would fail:

```ts
// web/rbac.ts
import { createRbacPlugin } from '@anievo-id/rbac-evolution-vue'

export const rbac = createRbacPlugin({ wildcard: true, loading: true })

export async function loadPermissions() {
  rbac.setSnapshot(await fetch('/api/me/permissions').then((r) => r.json()))
}
```

```vue
<script setup lang="ts">
const props = defineProps<{ order: { id: string; status: string; totalCents: number } }>()
</script>

<template>
  <section>
    <button v-can="'orders.ship'" :disabled="props.order.status !== 'paid'">Mark as shipped</button>
    <button v-can="'orders.cancel'">Cancel</button>
    <button v-can.any="['orders.refund.small', 'orders.refund.large']">Refund…</button>

    <p v-if="!$can('orders.refund.large') && props.order.totalCents > 10000">
      Refunds over $100 need a manager.
    </p>

    <RouterLink v-can="'reports.view'" to="/reports">Reports</RouterLink>
    <RouterLink v-can="'staff.manage'" to="/staff">Staff</RouterLink>
  </section>
</template>
```

## Edge cases

### The shorter-name trap

With wildcards, a **shorter** stored permission covers every longer one below it. If support had
`orders.refund`, they would also pass `can('orders.refund.large')`, because `orders.refund` is a prefix of it. Give
the two limits sibling names (`orders.refund.small` and `orders.refund.large`) and check the right one.

```ts
wildcardImplies('orders.refund', 'orders.refund.large') // true: the trap
wildcardImplies('orders.refund.small', 'orders.refund.large') // false
wildcardImplies('orders.*', 'orders.refund.large') // true: managers
```

### New actions reach managers automatically

When you add `orders.export` next month, managers can use it at once through `orders.*`, without a seed change.
That is usually what you want. For a destructive or sensitive action, put it outside the namespace (for example
`gdpr.erase-customer`) so no wildcard grants it by accident.

### Who can approve a large refund?

`subjectsWithPermission()` doesn't expand wildcards, so it won't find managers for `orders.refund.large`. Ask each
role instead, then list the people who have one of those roles:

```ts
const roles: Role[] = []
for (const role of await rbac.getRoles()) {
  if (await rbac.role(role).hasPermissionTo('orders.refund.large')) roles.push(role)
}
const approverIds = roles.length > 0 ? await rbac.subjectsWithRole('user', roles) : []
```

This finds roles only. Someone with a direct `orders.*` permission isn't in the list.

### Several shops

If a cashier works in one shop only, make each shop a [team](/basic-usage/teams) and assign roles per shop. The
[SaaS page](/use-cases/saas-multi-tenant) shows that setup.

## Test it

Test the refund rule with the real seed and wildcards on:

```ts
// test/refunds.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import { canRefund } from '../src/policies'
import type { ShopRbac } from '../src/rbac'
import { shopSeed } from '../src/seed'

describe('refunds', () => {
  let rbac: Rbac<ShopRbac>
  const sam = { type: 'user', id: 1 } // support
  const maya = { type: 'user', id: 2 } // manager
  const carl = { type: 'user', id: 3 } // cashier

  beforeEach(async () => {
    rbac = createRbac<ShopRbac>({ adapter: new MemoryAdapter(), cache: false, wildcard: true })
    await rbac.sync(shopSeed)
    await rbac.for(sam).assignRole('support')
    await rbac.for(maya).assignRole('manager')
    await rbac.for(carl).assignRole('cashier')
  })

  it('lets support refund small amounts only', async () => {
    expect(await canRefund(rbac.for(sam), 50_00)).toBe(true)
    expect(await canRefund(rbac.for(sam), 250_00)).toBe(false)
  })

  it('lets managers refund anything through orders.*', async () => {
    expect(await canRefund(rbac.for(maya), 250_00)).toBe(true)
  })

  it('never lets cashiers refund', async () => {
    expect(await canRefund(rbac.for(carl), 1_00)).toBe(false)
    expect(await rbac.for(carl).can('orders.create')).toBe(true)
  })
})
```

## Related

- [Wildcard permissions](/basic-usage/wildcard-permissions)
- [NestJS](/frameworks/nestjs) and [Vue](/frameworks/vue)
- [Typed names](/basic-usage/typed-names) (the wildcard warning)
- [Querying subjects](/advanced/querying-subjects)
- [Roles vs permissions](/best-practices/roles-vs-permissions)
