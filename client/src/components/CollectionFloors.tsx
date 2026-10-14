import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StorefrontSection } from '@shared/api.interface';

interface CollectionFloorsProps {
  sections: StorefrontSection[];
  favoriteIds: Set<string>;
  loading?: boolean;
}

/** 楼层右上角「查看全部」入口（按 slug 进入集合详情页） */
const FloorLink: React.FC<{ slug: string }> = ({ slug }) => {
  const { t } = useLanguage();
  return (
    <Link
      to={`/collections/${slug}`}
      className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600 hover:shadow"
    >
      {t.home.viewAll}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
};

/**
 * 首页运营楼层：每个精选集合一行，横向滚动展示集合内商品。
 * 标题/描述按当前语言择一；楼层右上角进入集合详情。
 */
const CollectionFloors: React.FC<CollectionFloorsProps> = ({ sections, favoriteIds, loading = false }) => {
  const { language, t } = useLanguage();

  if (loading) {
    return (
      <section className="container mx-auto px-6 py-8">
        <div className="py-12 text-center text-slate-400">{t.common.loading}</div>
      </section>
    );
  }

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => {
        const title = language === 'zh' ? section.titleZh : section.titleEn;
        const description = language === 'zh'
          ? section.descriptionZh ?? section.descriptionEn
          : section.descriptionEn ?? section.descriptionZh;

        return (
          <section key={section.id} className="container mx-auto px-6 py-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-sky-400 text-white shadow-sm">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="truncate text-xl font-semibold text-slate-900">{title}</h2>
                </div>
                {description && (
                  <p className="truncate text-sm text-slate-500">{description}</p>
                )}
              </div>
              <FloorLink slug={section.slug} />
            </div>

            <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
              {section.products.map((product) => (
                <div
                  key={product.id}
                  className="w-[46%] flex-shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19%]"
                >
                  <ProductCard product={product} favorited={favoriteIds.has(product.id)} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
};

export default CollectionFloors;
