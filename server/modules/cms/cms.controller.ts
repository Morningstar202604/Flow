import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

import { RolesGuard } from '@server/common/guards/roles.guard';
import { CmsService, type CmsPageDetail, type CmsPageListResponse } from './cms.service';

class CreateCmsPageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

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
  contentZh?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitleZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescEn?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

class UpdateCmsPageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

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
  contentZh?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitleZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescEn?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

class CmsPageQueryDto {
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
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  slug?: string;
}

@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  // Public: get published page by slug for frontend CMS rendering
  @Get('api/pages/:slug')
  async getBySlug(@Param('slug') slug: string): Promise<CmsPageDetail> {
    return this.cmsService.getBySlug(slug);
  }

  // Admin: create page
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post('api/cms/pages')
  async create(@Body() dto: CreateCmsPageDto): Promise<CmsPageDetail> {
    return this.cmsService.create(dto);
  }

  // Admin: list pages
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('api/cms/pages')
  async list(@Query() query: CmsPageQueryDto): Promise<CmsPageListResponse> {
    return this.cmsService.list(query);
  }

  // Admin: get page by id
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Get('api/cms/pages/:id')
  async getById(@Param('id') id: string): Promise<CmsPageDetail> {
    return this.cmsService.getById(id);
  }

  // Admin: update page
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Put('api/cms/pages/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCmsPageDto,
  ): Promise<CmsPageDetail> {
    return this.cmsService.update(id, dto);
  }

  // Admin: delete page
  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Delete('api/cms/pages/:id')
  async remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.cmsService.remove(id);
  }
}
