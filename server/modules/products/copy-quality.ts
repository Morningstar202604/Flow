import type { Product } from '../../../shared/api.interface';

export interface CopyQualityIssue {
  key: string;
  label: string;
  detail: string;
}

export interface CopyQualityReport {
  productId: string;
  title: string;
  score: number;
  issues: CopyQualityIssue[];
  needsReview: boolean;
}

const MIN_TITLE_EN = 15;
const MAX_TITLE_EN = 200;
const MIN_BULLETS = 3;
const MIN_LONG_DESC = 80;
const MIN_SEO_KEYWORDS = 2;
/** 常见"AI 占位/敷衍"痕迹 */
const LAZY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(lorem ipsum|placeholder|todo|tbd|n\/a)\b/i, label: '含占位词' },
  { re: /^(product|item|goods)\s*\d*$/i, label: '标题像占位名' },
  { re: /\b(very good|high quality|best product)\b/i, label: '空泛套话' },
];

/**
 * AI 文案质量启发式评估（不调用 LLM，零成本）。
 * 目的：把"明显不合格"的 AI 文案筛出来，进入人工复核队列，而不是直接上架。
 * 这是启发式，不是语义评判——判为合格仍需人看，判为不合格一定有明确理由。
 */
export function evaluateCopyQuality(product: Product): CopyQualityReport {
  const issues: CopyQualityIssue[] = [];
  const titleEn = (product.titleEn ?? '').trim();
  const bullets = product.bulletPointsEn ?? [];
  const longDesc = (product.longDescEn ?? '').trim();
  const seo = (product.seoKeywordsEn ?? '').trim();

  if (titleEn.length === 0) {
    issues.push({ key: 'title_missing', label: '缺英文标题', detail: 'title_en 为空' });
  } else {
    if (titleEn.length < MIN_TITLE_EN) {
      issues.push({ key: 'title_short', label: '英文标题过短', detail: `${titleEn.length} 字符，建议 ≥${MIN_TITLE_EN}` });
    }
    if (titleEn.length > MAX_TITLE_EN) {
      issues.push({ key: 'title_long', label: '英文标题过长', detail: `${titleEn.length} 字符，建议 ≤${MAX_TITLE_EN}` });
    }
    for (const pattern of LAZY_PATTERNS) {
      if (pattern.re.test(titleEn)) {
        issues.push({ key: 'title_lazy', label: `标题${pattern.label}`, detail: titleEn.slice(0, 60) });
      }
    }
  }

  if (bullets.length < MIN_BULLETS) {
    issues.push({
      key: 'bullets_few',
      label: '卖点不足',
      detail: `${bullets.length} 条，建议 ≥${MIN_BULLETS}`,
    });
  }
  const emptyBullets = bullets.filter((point) => !point || point.trim().length < 8).length;
  if (emptyBullets > 0) {
    issues.push({ key: 'bullets_empty', label: '卖点过短', detail: `${emptyBullets} 条少于 8 字符` });
  }

  if (longDesc.length < MIN_LONG_DESC) {
    issues.push({
      key: 'desc_short',
      label: '长描述不足',
      detail: `${longDesc.length} 字符，建议 ≥${MIN_LONG_DESC}`,
    });
  }
  for (const pattern of LAZY_PATTERNS) {
    if (longDesc && pattern.re.test(longDesc)) {
      issues.push({ key: 'desc_lazy', label: `描述${pattern.label}`, detail: pattern.re.source.slice(0, 40) });
      break;
    }
  }

  const keywords = seo.split(',').map((item) => item.trim()).filter(Boolean);
  if (keywords.length < MIN_SEO_KEYWORDS) {
    issues.push({
      key: 'seo_few',
      label: 'SEO 关键词不足',
      detail: `${keywords.length} 个，建议 ≥${MIN_SEO_KEYWORDS}`,
    });
  }

  // 中英文混入检查（英文文案里不应出现大段中文）
  const chineseChars = (titleEn.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  if (chineseChars > 2) {
    issues.push({ key: 'title_not_en', label: '英文标题含中文', detail: `${chineseChars} 个中文字符` });
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return {
    productId: product.id,
    title: product.titleZh || product.titleEn,
    score,
    issues,
    needsReview: issues.length > 0,
  };
}
