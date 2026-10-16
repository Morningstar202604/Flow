import type { Language } from '@shared/api.interface';

/** 语言 → BCP-47 区域码（用于 toLocaleString / toLocaleDateString） */
const LOCALE_MAP: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
};

/** 取当前语言的区域码，供日期/数字本地化使用 */
export function getLocale(language: Language): string {
  return LOCALE_MAP[language] ?? 'en-US';
}

/**
 * 内容字段本地化取值。
 * 说明：类目 / 集合 / CMS 等内容的数据库字段只有中英两语（设计如此，未存西/葡），
 * 因此西/葡用户回退到英文——显式统一此行为，避免各处散落 `language === 'zh' ? a : b`
 * 造成"看起来有西语但其实是空"的误导。
 */
export function pickLocalized(
  zh: string | null | undefined,
  en: string | null | undefined,
  language: Language,
): string {
  if (language === 'zh') {
    return zh || en || '';
  }
  return en || zh || '';
}

/** 格式化日期时间（跟随当前语言区域） */
export function formatDateTime(value: string | number | Date | null | undefined, language: Language): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(getLocale(language));
}

/** 格式化日期（仅日期部分，跟随当前语言区域） */
export function formatDate(value: string | number | Date | null | undefined, language: Language): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(getLocale(language));
}
