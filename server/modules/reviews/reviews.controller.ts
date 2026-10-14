import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/reviews.dto';
import type {
  ProductReview,
  ProductReviewsResponse,
} from '../../../shared/api.interface';

@Controller('products')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id/reviews')
  async getReviews(@Param('id') productId: string): Promise<ProductReviewsResponse> {
    return this.reviewsService.getProductReviews(productId);
  }

  @Get(':id/reviews/my')
  async getMyReview(
    @Req() req: Request,
    @Param('id') productId: string,
  ): Promise<{ review: ProductReview | null; hasPurchased: boolean }> {
    const userId = req.user?.id;
    const review = await this.reviewsService.getUserReviewForProduct(productId, userId);
    const hasPurchased = await this.reviewsService.hasPurchased(productId, userId);
    return { review, hasPurchased };
  }

  @Post(':id/reviews')
  @UseGuards(new RolesGuard(['buyer']))
  async createReview(
    @Req() req: Request,
    @Param('id') productId: string,
    @Body() body: CreateReviewDto,
  ): Promise<ProductReview> {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('请先登录后评价');
    return this.reviewsService.createReview(productId, userId, body);
  }
}
