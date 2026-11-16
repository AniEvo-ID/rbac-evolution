// Stub: a copy of the `src/orders.controller.ts` block of docs/use-cases/ecommerce-admin.md.
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
