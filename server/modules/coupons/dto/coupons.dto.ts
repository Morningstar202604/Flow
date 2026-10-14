import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CouponDiscountType } from '../coupon-discount';

const COUPON_TYPES: CouponDiscountType[] = ['percent', 'fixed', 'free_shipping'];
const APPLIES_TO: Array<'all' | 'category' | 'product'> = ['all', 'category', 'product'];
type CouponAppliesTo = 'all' | 'category' | 'product';

export class ValidateCouponDto {
  @IsString()
  @Length(1, 50, { message: '优惠码长度不合法' })
  code!: string;

  @IsNumber({}, { message: '订单金额必须是数字' })
  @Min(0, { message: '订单金额不能为负' })
  @Max(1_000_000_000)
  orderAmount!: number;
}

export class CreateCouponDto {
  @IsString()
  @Length(2, 50, { message: '优惠码长度需为 2-50 字符' })
  code!: string;

  @IsIn(COUPON_TYPES, { message: '不支持的优惠券类型' })
  type!: CouponDiscountType;

  @IsOptional()
  @IsNumber({}, { message: '面额必须是数字' })
  @Min(0)
  @Max(1_000_000)
  value?: number;

  @IsOptional()
  @IsIn(APPLIES_TO)
  appliesTo?: CouponAppliesTo;

  @IsOptional()
  @IsArray()
  appliesToIds?: string[];

  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  minOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  totalQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perUserLimit?: number;

  @IsOptional()
  @IsDateString({}, { message: '过期时间格式不正确' })
  expiresAt?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  code?: string;

  @IsOptional()
  @IsIn(COUPON_TYPES)
  type?: CouponDiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  value?: number;

  @IsOptional()
  @IsIn(APPLIES_TO)
  appliesTo?: CouponAppliesTo;

  @IsOptional()
  @IsArray()
  appliesToIds?: string[];

  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuantity?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GenerateBulkCodesDto {
  @IsString()
  @MaxLength(30, { message: '基础码不能超过 30 字符' })
  baseCode!: string;

  @IsInt()
  @Min(1)
  @Max(1000, { message: '批量生成数量必须在 1-1000 之间' })
  count!: number;
}
