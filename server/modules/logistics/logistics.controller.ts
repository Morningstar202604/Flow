import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsString } from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LogisticsService, type TrackingInfo } from './logistics.service';

class RegisterTrackingDto {
  @IsString()
  orderId!: string;

  @IsString()
  carrier!: string;

  @IsString()
  trackingNumber!: string;
}

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Get(':orderId')
  async getTracking(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ): Promise<TrackingInfo> {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole === 'seller' || userRole === 'admin') {
      return this.logisticsService.getTrackingInfo(orderId);
    }

    const sessionId = this.extractSessionId(req);

    if (userId || sessionId) {
      await this.logisticsService.verifyOrderOwnership(orderId, userId, sessionId);
    } else {
      throw new BadRequestException('请提供用户身份或会话ID');
    }

    return this.logisticsService.getTrackingInfo(orderId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post()
  async registerTracking(
    @Body() dto: RegisterTrackingDto,
  ): Promise<{ success: boolean; isDemo: boolean }> {
    return this.logisticsService.registerTracking(
      dto.orderId,
      dto.carrier,
      dto.trackingNumber,
    );
  }

  private extractSessionId(req: Request): string | undefined {
    const header = req.headers['x-session-id'];
    if (typeof header === 'string' && header) return header;
    if (Array.isArray(header) && header.length > 0) return header[0];
    const query = req.query.sessionId;
    if (typeof query === 'string' && query) return query;
    return undefined;
  }
}
