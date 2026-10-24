import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';
import type { AuditLogListResponse } from '../../../shared/api.interface';

/** 审计查询：卖家按 userId 收口，管理员可看全量 */

class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get()
  async getAuditLogs(
    @Req() req: Request,
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogListResponse> {
    // 卖家仅看自己产生的审计记录（管理员看全量），避免跨店操作与 IP 泄露
    const isAdmin = req.user?.role === 'admin';
    return this.auditService.getAuditLogs({
      ...query,
      userId: isAdmin ? undefined : req.user?.id,
    });
  }
}
