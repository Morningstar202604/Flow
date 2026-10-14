import {
  Controller,
  Get,
  Post,
  Req,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '../../common/guards/roles.guard';
import { FavoritesService } from './favorites.service';
import type { FavoriteProduct } from '../../../shared/api.interface';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async getMyFavorites(@Req() req: Request): Promise<FavoriteProduct[]> {
    const userId = req.user?.id;
    return this.favoritesService.getMyFavorites(userId);
  }

  @Post(':productId')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async toggle(
    @Req() req: Request,
    @Param('productId') productId: string,
  ): Promise<{ favorited: boolean; id?: string }> {
    const userId = req.user?.id;
    return this.favoritesService.toggle(productId, userId);
  }

  @Get('check/:productId')
  async check(
    @Req() req: Request,
    @Param('productId') productId: string,
  ): Promise<{ favorited: boolean }> {
    const userId = req.user?.id;
    const favorited = await this.favoritesService.isFavorited(productId, userId);
    return { favorited };
  }

  @Get('check-batch')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async checkBatch(
    @Req() req: Request,
    @Query('productIds') productIds: string,
  ): Promise<{ favoritedIds: string[] }> {
    const userId = req.user?.id;
    if (!productIds) {
      throw new BadRequestException('productIds 不能为空');
    }
    const ids = productIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      return { favoritedIds: [] };
    }
    const favoritedIds = await this.favoritesService.isFavoritedBatch(ids, userId);
    return { favoritedIds };
  }
}
