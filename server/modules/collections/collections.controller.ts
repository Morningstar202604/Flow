import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionsService } from './collections.service';

// ==================== DTOs ====================

class CreateCollectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  descriptionZh?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsBoolean()
  isSmart?: boolean;

  @IsOptional()
  @IsArray()
  smartRules?: Array<{ field: string; operator: string; value: string | number }>;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;
}

class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleZh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  descriptionZh?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsBoolean()
  isSmart?: boolean;

  @IsOptional()
  @IsArray()
  smartRules?: Array<{ field: string; operator: string; value: string | number }>;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;
}

class CollectionListQueryDto {
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
  @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isSmart?: boolean;

  @IsOptional()
  @IsString()
  keyword?: string;
}

class AddProductDto {
  @IsString()
  productId!: string;
}

class ReorderProductsDto {
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}

// ==================== Controller ====================

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // ── Public endpoints (must come before seller-guarded routes to avoid conflicts) ──

  @Get('featured')
  async getFeatured() {
    return this.collectionsService.getFeatured();
  }

  /** 店铺楼层（买家首页）：精选集合 + 集合内完整商品 */
  @Get('storefront')
  async getStorefront() {
    return this.collectionsService.getStorefront();
  }

  /** 集合详情（买家端公开，按 slug） */
  @Get('by-slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.collectionsService.getBySlug(slug);
  }

  // ── Seller endpoints ─────────────────────────

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateCollectionDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.create(sellerId, dto);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get()
  async list(
    @Req() req: Request,
    @Query() query: CollectionListQueryDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.list(sellerId, query);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.collectionsService.getOne(id);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.update(id, sellerId, dto);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.remove(id, sellerId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post(':id/products')
  async addProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AddProductDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.addProduct(id, sellerId, body.productId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Delete(':id/products/:productId')
  async removeProduct(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.removeProduct(id, sellerId, productId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Put(':id/products/reorder')
  async reorderProducts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ReorderProductsDto,
  ) {
    const sellerId = req.user?.id;
    if (!sellerId) throw new BadRequestException('用户未登录');
    return this.collectionsService.reorderProducts(id, sellerId, body.productIds);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get(':id/smart-products')
  async getSmartProducts(@Param('id') id: string) {
    return this.collectionsService.getSmartProducts(id);
  }
}
