import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { DashboardData } from '../../../shared/api.interface';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('stats')
  async getStats(@Req() req: Request): Promise<DashboardData> {
    return this.dashboardService.getStats({
      sellerId: req.user?.id,
      role: req.user?.role,
    });
  }
}
