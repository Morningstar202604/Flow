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
    return this.auditService.getAuditLogs(query);
  }
}
