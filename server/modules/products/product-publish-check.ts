import type { Product } from '../../../shared/api.interface';

export interface PublishCheck {
  key: string;
  label: string;
  ok: boolean;
  /** 未通过时给卖家的具体修法 */
  hint?: string;
}

export interface PublishReadiness {
  ready: boolean;
  checks: PublishCheck[];
  /** 未通过项数量，便于前端展示 */
  blockingCount: number;
}

/**
 * 草稿上架门禁：把"能上架"的定义写成可测的规则，避免脏草稿直接对外可见。
 * 只做只读校验，不做任何修改。
 */
export function evaluatePublishReadiness(product: Product): PublishReadiness {
  const checks: PublishCheck[] = [
    {
      key: 'title',
      label: '中英文标题均非空',
      ok: product.titleZh.trim().length > 0 && product.titleEn.trim().length > 0,
      hint: '补齐中文与英文标题',
    },
    {
      key: 'image',
      label: '至少 1 张商品图',
      ok: !!product.coverImage || product.images.length > 0,
      hint: '上传封面图或详情图',
    },
    {
      key: 'price',
      label: '售价大于 0',
      ok: Number(product.minPrice ?? 0) > 0,
      hint: '设置大于 0 的售价',
    },
    {
      key: 'stock',
      label: '总库存大于 0',
      ok: product.totalStock > 0,
      hint: '补充库存或设置可售数量',
    },
    {
      key: 'description',
      label: '至少一段商品描述',
      ok: (product.descZh || product.descEn || product.longDescZh || product.longDescEn).trim().length > 0,
      hint: '用「AI 生成文案」补全描述',
    },
    {
      key: 'category',
      label: '已选择分类',
      ok: !!product.categoryId,
      hint: '选择一个分类，便于买家筛选',
    },
  ];

  const blockingCount = checks.filter((check) => !check.ok).length;
  return { ready: blockingCount === 0, checks, blockingCount };
}
