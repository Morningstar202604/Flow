import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Base URL 不能超过 300 字符' })
  @Matches(/^https?:\/\//, { message: 'Base URL 需以 http(s):// 开头' })
  baseUrl?: string;

  /** 传空字符串表示清除 UI 中保存的 Key（回退到环境变量或未配置） */
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'API Key 不能超过 300 字符' })
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '模型名不能超过 100 字符' })
  model?: string;
}

export class CreateAgentDto {
  @IsString()
  @Length(1, 100, { message: '名称长度需为 1-100 字符' })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 50, { message: '标识需为 3-50 字符的小写字母/数字/连字符' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '描述不能超过 500 字符' })
  description?: string;

  @IsString()
  @Length(1, 4000, { message: '系统提示词长度需为 1-4000 字符' })
  systemPrompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: '用户提示词模板不能超过 4000 字符' })
  userPromptTemplate?: string;

  @IsOptional()
  @IsIn(['text', 'json'], { message: '输出格式只能是 text 或 json' })
  responseFormat?: 'text' | 'json';

  @IsOptional()
  @IsNumber({}, { message: 'temperature 必须是数字' })
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000, { message: 'maxTokens 需在 100-8000 之间' })
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  userPromptTemplate?: string;

  @IsOptional()
  @IsIn(['text', 'json'])
  responseFormat?: 'text' | 'json';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class RunAgentDto {
  @IsString()
  @Length(1, 4000, { message: '输入长度需为 1-4000 字符' })
  input!: string;
}
