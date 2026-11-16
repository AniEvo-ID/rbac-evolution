// Stub: a copy of the `src/staff.controller.ts` block of docs/use-cases/ecommerce-admin.md.
import { BadRequestException, Body, Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common'
import { isRoleName } from '@anievo-id/rbac-evolution'
import { rbac, RequirePermissions } from './rbac'
import { StaffService } from './staff.service'

@Controller('staff')
@RequirePermissions('staff.manage') // every route of this controller
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Put(':id/job')
  setJob(@Param('id', ParseIntPipe) id: number, @Body() body: { role?: unknown }) {
    // The body is user input: an unknown role would make syncRoles() throw (a 500).
    if (!isRoleName(rbac, body.role)) throw new BadRequestException('Unknown role')
    return this.staff.setJob(id, body.role) // narrowed to RoleName<ShopRbac>
  }

  @Delete(':id')
  offboard(@Param('id', ParseIntPipe) id: number) {
    return this.staff.offboard(id)
  }
}
