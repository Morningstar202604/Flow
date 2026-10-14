import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID(undefined, { message: 'productId 必须是合法 UUID' })
  productId!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'variantId 必须是合法 UUID' })
  variantId?: string;

  @IsInt({ message: '数量必须是整数' })
  @Min(1, { message: '数量至少为 1' })
  @Max(999, { message: '数量不能超过 999' })
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt({ message: '数量必须是整数' })
  @Min(1, { message: '数量至少为 1' })
  @Max(999, { message: '数量不能超过 999' })
  quantity!: number;
}

export class ImportCartCodeDto {
  @IsString()
  @Length(4, 64, { message: '迁移码长度不合法' })
  code!: string;
}
