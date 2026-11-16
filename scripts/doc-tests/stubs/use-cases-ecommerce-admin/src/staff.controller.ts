// Stub: a copy of the `src/staff.controller.ts` block of docs/use-cases/ecommerce-admin.md.
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
