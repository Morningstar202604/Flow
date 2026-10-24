import { Inject, Injectable } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';
import { cmsPages, collections, products } from '../../database/schema';

export interface PageMeta {
  title: string;
  description: string;
  canonicalPath: string;
  ogType: 'website' | 'product' | 'article';
  image?: string;
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

const SITE_NAME = 'Flow';
const DEFAULT_TITLE = 'Flow — 让跨境生意更简单 · Cross-Border Commerce, Simplified';
const DEFAULT_DESCRIPTION =
  'Flow 是 AI 原生的跨境出口电商平台：买家商城 + 卖家 AI 工作台，内置 5 个真实 AI Agent 与人工审批式运营副驾，覆盖上架、获客、成交、客服与复盘全链路。';
const SITE_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

@Injectable()
export class SeoService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  private absolute(path: string): string {
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async productMeta(id: string): Promise<PageMeta | null> {
    const rows = await this.db
      .select({
        id: products.id,
        titleZh: products.titleZh,
        titleEn: products.titleEn,
        descZh: products.descZh,
        descEn: products.descEn,
        coverImage: products.coverImage,
        totalStock: products.totalStock,
        avgRating: products.avgRating,
        reviewCount: products.reviewCount,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(eq(products.id, id), eq(products.status, 'active')))
      .limit(1);
    const p = rows[0];
    if (!p) return null;
    const priceRows = await this.db.execute<{ price: string }>(sql`
      SELECT MIN(price)::text AS price FROM product_variants
      WHERE product_id = ${id} AND status = 'active'
    `);
    const price = priceRows[0]?.price ?? '0';
    const title = `${p.titleEn || p.titleZh} · ${SITE_NAME}`;
    const description = (p.descEn || p.descZh || '').slice(0, 200) || DEFAULT_DESCRIPTION;
    return {
      title,
      description,
      canonicalPath: `/products/${p.id}`,
      ogType: 'product',
      image: p.coverImage || undefined,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.titleEn || p.titleZh,
        description,
        image: p.coverImage ? [p.coverImage] : undefined,
        sku: p.id,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price,
          availability: p.totalStock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: this.absolute(`/products/${p.id}`),
        },
        ...(Number(p.reviewCount) > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(p.avgRating),
                reviewCount: Number(p.reviewCount),
              },
            }
          : {}),
      },
    };
  }

  private async collectionMeta(slug: string): Promise<PageMeta | null> {
    const rows = await this.db
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.status, 'active')))
      .limit(1);
    const c = rows[0];
    if (!c) return null;
    return {
      title: `${c.titleEn || c.titleZh} · ${SITE_NAME}`,
      description: (c.descriptionEn || c.descriptionZh || DEFAULT_DESCRIPTION).slice(0, 200),
      canonicalPath: `/collections/${c.slug}`,
      ogType: 'website',
      image: c.coverImage || undefined,
    };
  }

  private async cmsMeta(slug: string): Promise<PageMeta | null> {
    const rows = await this.db
      .select()
      .from(cmsPages)
      .where(and(eq(cmsPages.slug, slug), eq(cmsPages.isPublished, true)))
      .limit(1);
    const page = rows[0];
    if (!page) return null;
    return {
      title: `${page.metaTitleEn || page.titleEn || page.titleZh} · ${SITE_NAME}`,
      description: (page.metaDescEn || page.metaDescZh || DEFAULT_DESCRIPTION).slice(0, 200),
      canonicalPath: `/page/${page.slug}`,
      ogType: 'article',
    };
  }

  /** 根据前端路由解析页面元信息（供 SSR-lite 注入与客户端兜底） */
  async resolvePath(rawPath: string): Promise<PageMeta> {
    const path = rawPath.split('?')[0].replace(/\/$/, '') || '/';
    try {
      const productMatch = /^\/products\/([\w-]+)$/.exec(path);
      if (productMatch) {
        const meta = await this.productMeta(productMatch[1]);
        if (meta) return meta;
      }
      const collectionMatch = /^\/collections\/([\w-]+)$/.exec(path);
      if (collectionMatch) {
        const meta = await this.collectionMeta(collectionMatch[1]);
        if (meta) return meta;
      }
      const cmsMatch = /^\/page\/([\w-]+)$/.exec(path);
      if (cmsMatch) {
        const meta = await this.cmsMeta(cmsMatch[1]);
        if (meta) return meta;
      }
    } catch {
      // 数据库不可用时退回默认元信息，不影响页面访问
    }

    if (path === '/' || path === '') {
      return {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        canonicalPath: '/',
        ogType: 'website',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
          description: DEFAULT_DESCRIPTION,
        },
      };
    }
    return {
      title: path.startsWith('/seller') ? `卖家工作台 · ${SITE_NAME}` : DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: path,
      ogType: 'website',
      noindex: path.startsWith('/seller') || path.startsWith('/checkout') || path.startsWith('/orders'),
    };
  }

  /** SEO-lite 注入：把 meta / OG / JSON-LD 写进 index.html 的占位注释 */
  renderHtml(template: string, meta: PageMeta): string {
    const esc = (value: string): string =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const canonical = this.absolute(meta.canonicalPath);
    const tags = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}">`,
      `<link rel="canonical" href="${esc(canonical)}">`,
      meta.noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">',
      `<meta property="og:site_name" content="${SITE_NAME}">`,
      `<meta property="og:title" content="${esc(meta.title)}">`,
      `<meta property="og:description" content="${esc(meta.description)}">`,
      `<meta property="og:type" content="${meta.ogType}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      meta.image ? `<meta property="og:image" content="${esc(meta.image)}">` : '',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + esc(meta.title) + '">',
      '<meta name="twitter:description" content="' + esc(meta.description) + '">',
      meta.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\u003c')}</script>`
        : '',
    ].filter(Boolean).join('\n  ');
    // 先移除模板里的兜底 title，再注入服务端生成的 title（顺序不能反，否则会删掉注入结果）
    return template
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace('<!--seo-->', tags);
  }

  async sitemap(): Promise<string> {
    const [productRows, collectionRows, pageRows] = await Promise.all([
      this.db
        .select({ id: products.id, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.status, 'active'))
        .orderBy(desc(products.updatedAt))
        .limit(5000),
      this.db
        .select({ slug: collections.slug, updatedAt: collections.updatedAt })
        .from(collections)
        .where(eq(collections.status, 'active'))
        .limit(1000),
      this.db
        .select({ slug: cmsPages.slug, updatedAt: cmsPages.updatedAt })
        .from(cmsPages)
        .where(eq(cmsPages.isPublished, true))
        .limit(1000),
    ]);

    const entry = (path: string, lastmod?: Date, priority = '0.7'): string =>
      `<url><loc>${this.absolute(path)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      entry('/', undefined, '1.0'),
      entry('/products', undefined, '0.9'),
      ...collectionRows.map((row) => entry(`/collections/${row.slug}`, row.updatedAt, '0.7')),
      ...productRows.map((row) => entry(`/products/${row.id}`, row.updatedAt, '0.8')),
      ...pageRows.map((row) => entry(`/page/${row.slug}`, row.updatedAt, '0.5')),
      '</urlset>',
    ].join(String.fromCharCode(10));
  }

  robots(): string {
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /seller',
      'Disallow: /checkout',
      'Disallow: /orders',
      'Disallow: /api/',
      '',
      `Sitemap: ${this.absolute('/sitemap.xml')}`,
      '',
    ].join(String.fromCharCode(10));
  }

  /** llms.txt：给 AI 代理/爬虫的可读站点说明（agentic commerce 入口） */
  llmsTxt(): string {
    return [
      '# Flow — AI-Native Cross-Border Commerce Platform',
      '',
      '> Flow is an open-source AI-native cross-border e-commerce platform with a buyer storefront and a seller AI workbench. It ships 5 real LLM agents and a human-in-the-loop operations copilot.',
      '',
      '## Public routes',
      `- Storefront: ${this.absolute('/')}`,
      `- Products: ${this.absolute('/products')}`,
      `- Collections: ${this.absolute('/collections/{slug}')}`,
      `- CMS pages: ${this.absolute('/page/{slug}')}`,
      '',
      '## APIs',
      `- Product list: GET ${this.absolute('/api/products')} (JSON, paginated)`,
      `- Product detail: GET ${this.absolute('/api/products/{id}')}`,
      `- Storefront sections: GET ${this.absolute('/api/collections/storefront')}`,
      `- Health: GET ${this.absolute('/api/health')}`,
      `- OpenAPI: ${this.absolute('/api/openapi.json')}`,
      '',
      '## Notes',
      '- Prices are in USD. Only products with status=active are publicly visible.',
      '- AI features degrade honestly: without a configured model they return an explicit error instead of fabricated data.',
      '',
    ].join(String.fromCharCode(10));
  }
}
