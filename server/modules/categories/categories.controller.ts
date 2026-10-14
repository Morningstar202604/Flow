import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IsString, IsOptional, IsInt, MinLength, MaxLength } from 'class-validator';
import type { Category } from '../../../shared/api.interface';
import { CategoriesService } from './categories.service';

class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameZh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameZh?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateCategoryDto,
  ): Promise<Category> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('用户未登录');
    return this.categoriesService.create(dto, userId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('用户未登录');
    return this.categoriesService.update(id, dto, userId);
  }

  @UseGuards(new RolesGuard(['seller', 'admin']))
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.categoriesService.remove(id);
  }
}
