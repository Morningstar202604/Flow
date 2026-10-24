import type { Product } from '@shared/api.interface';

/** 客户端路由级文档标题/描述（服务端已注入首屏，客户端切换路由后保持同步） */
export function applyDocumentMeta(title: string, description?: string): void {
  document.title = title;
  if (!description) return;
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.appendChild(tag);
  }
  tag.content = description;
}

export function applyCanonical(path: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = `${window.location.origin}${path}`;
}

const SITE = 'Flow';

export function productMeta(product: Product): { title: string; description: string } {
  return {
    title: `${product.titleEn || product.titleZh} · ${SITE}`,
    description: (product.descEn || product.descZh || '').slice(0, 200),
  };
}

interface JsonLdProductInput {
  product: Product;
  url: string;
}

export function injectProductJsonLd({ product, url }: JsonLdProductInput): void {
  const id = 'flow-product-jsonld';
  document.getElementById(id)?.remove();
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  const price = product.minPrice ?? product.variants[0]?.price ?? '0';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.titleEn || product.titleZh,
    description: (product.descEn || product.descZh || '').slice(0, 300),
    image: product.coverImage ? [product.coverImage] : product.images,
    sku: product.id,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price,
      availability: product.totalStock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
    },
    ...(product.reviewCount && product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.avgRating ?? 0,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  });
  document.head.appendChild(script);
}

export function injectOrganizationJsonLd(): void {
  const id = 'flow-org-jsonld';
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE,
    url: window.location.origin,
    description: 'AI-native cross-border commerce platform with a buyer storefront and a seller AI workbench.',
  });
  document.head.appendChild(script);
}
