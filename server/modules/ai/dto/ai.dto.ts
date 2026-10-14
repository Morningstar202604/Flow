import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Language } from '../../../../shared/api.interface';

const SUPPORTED_LANGUAGES: Language[] = ['zh', 'en', 'es', 'pt'];

export class SupportChatDto {
  @IsString()
  @Length(1, 2000, { message: '消息长度需为 1-2000 字符' })
  message!: string;

  @IsString()
  @Length(8, 64, { message: 'sessionId 长度需为 8-64 字符' })
  sessionId!: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES, { message: '不支持的语言代码' })
  language?: Language;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderNo?: string;
}

export class CopywriterDto {
  @IsString()
  @Length(1, 200, { message: '商品名称长度需为 1-200 字符' })
  productNameZh!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetMarket?: string;
}

export class TranslationDto {
  @IsString()
  @Length(1, 5000, { message: '文本长度需为 1-5000 字符' })
  text!: string;

  @IsString()
  @Length(2, 10, { message: '目标语言代码不合法' })
  targetLang!: string;

  @IsOptional()
  @IsString()
  @Length(2, 10)
  sourceLang?: string;
}
