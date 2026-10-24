import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: '评分必须是整数' })
  @Min(1, { message: '评分必须在 1-5 之间' })
  @Max(5, { message: '评分必须在 1-5 之间' })
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: '评价内容不能超过 2000 字符' })
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
