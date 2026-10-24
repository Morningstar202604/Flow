import { describe, expect, it } from 'vitest';
import { SeoService } from './seo.service';
import { buildOpenApiSpec } from './openapi';

describe('SEO 渲染', () => {
  const service = new SeoService({} as never);

  it('注入 title / description / OG / JSON-LD 并移除模板兜底 title', () => {
    const template = '<html><head><!--seo--><title>fallback</title></head><body></body></html>';
    const html = service.renderHtml(template, {
      title: 'Test Product · Flow',
      description: 'A <script>alert(1)</script> description',
      canonicalPath: '/products/abc',
      ogType: 'product',
      jsonLd: { '@type': 'Product', name: 'Test' },
    });
    expect(html).toContain('<title>Test Product · Flow</title>');
    expect(html).toContain('application/ld+json');
    expect(html.split('<title>').length).toBe(2);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('og:type" content="product"');
  });

  it('订单/结算/卖家路由标记 noindex', async () => {
    const orders = await service.resolvePath('/orders');
    expect(orders.noindex).toBe(true);
    const home = await service.resolvePath('/');
    expect(home.noindex).toBeUndefined();
    expect(home.jsonLd?.['@type']).toBe('Organization');
  });
});

describe('OpenAPI 描述', () => {
  it('是有效的 3.1 文档且包含核心端点与安全方案', () => {
    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe('3.1.0');
    const paths = spec.paths as Record<string, unknown>;
    expect(Object.keys(paths)).toContain('/api/products');
    expect(Object.keys(paths)).toContain('/api/orders');
    expect(Object.keys(paths)).toContain('/api/payments/pay');
    const components = spec.components as { securitySchemes: Record<string, unknown> };
    expect(components.securitySchemes.cookieAuth).toBeTruthy();
  });
});
