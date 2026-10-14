import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255, { message: '邮箱不能超过 255 字符' })
  email!: string;

  @IsString()
  @Length(8, 72, { message: '密码长度需为 8-72 位' })
  password!: string;

  @IsString()
  @Length(1, 100, { message: '姓名不能为空且不超过 100 字符' })
  name!: string;

  @IsOptional()
  @IsIn(['buyer', 'seller'], { message: '角色只能是 buyer 或 seller' })
  role?: 'buyer' | 'seller';

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '邀请码不能超过 100 字符' })
  sellerCode?: string;
}

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString()
  @Length(1, 72, { message: '密码长度不合法' })
  password!: string;
}
