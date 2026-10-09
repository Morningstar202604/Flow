import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import ProductCard from '@/components/ProductCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { getFeaturedProducts, listProducts } from '@/api/products';
import { listCategories } from '@/api/categories';
import { checkFavoriteBatch } from '@/api/favorites';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, Category } from '@shared/api.interface';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [hotProducts, setHotProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        setLoading(true);
        const [cats, hot, newest] = await Promise.all([
          listCategories(),
          getFeaturedProducts(8),
          listProducts({ page: 1, pageSize: 8, sortBy: 'newest' }),
        ]);
        setCategories(cats);
         setHotProducts(hot);
         setNewProducts(newest.items);
         if (user) {
           const allIds = [...hot, ...newest.items].map((p) => p.id);
           const uniqueIds = Array.from(new Set(allIds));
           try {
             const faves = await checkFavoriteBatch(uniqueIds);
             setFavoriteIds(new Set(faves));
           } catch (favErr) {
             console.error('[home] load favorites error', favErr);
           }
         }
      } catch (error: unknown) {
        console.error('[home] load error', error);
      } finally {
        setLoading(false);
      }
    };
    void loadData();
   }, [user]);

  const displayCategories: Category[] = categories.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-sky-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTh2MkgyNHYtMmgxMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="container mx-auto px-6 py-20 sm:py-28 relative z-10">
          <div className="max-w-2xl text-white">
            <Badge className="mb-4 bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Sparkles className="size-4 mr-1" />
              GlobalEcom
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
              {t.home.heroTitle}
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 mb-8">
              {t.home.heroSubtitle}
            </p>
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
              onClick={() => navigate('/products')}
            >
              <ShoppingBag className="size-5 mr-2" />
              {t.home.shopNow}
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            {t.home.categories}
          </h2>
          <Button variant="ghost" asChild>
            <Link to="/products">{t.home.viewAll}</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {displayCategories.map((cat: Category) => {
            const name: string =
              language === 'zh' ? cat.nameZh : cat.nameEn;
            return (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                className="group"
              >
                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all text-center border border-slate-100 hover:border-blue-200">
                  <div className="size-14 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                    {cat.icon ? (
                      <Image
                        src={cat.icon}
                        alt={name}
                        width={28}
                        height={28}
                        className="size-7"
                      />
                    ) : (
                      <ShoppingBag className="size-7" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                    {name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Hot Products */}
      <section className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-orange-500" />
            <h2 className="text-xl font-semibold text-slate-900">
              {t.home.hotProducts}
            </h2>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/products?sortBy=sold_desc">{t.home.viewAll}</Link>
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500">
            {t.common.loading}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
             {hotProducts.map((product: Product) => (
               <ProductCard
                 key={product.id}
                 product={product}
                 favorited={favoriteIds.has(product.id)}
               />
             ))}
          </div>
        )}
      </section>

      {/* New Arrivals */}
      <section className="container mx-auto px-6 py-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-sky-500" />
            <h2 className="text-xl font-semibold text-slate-900">
              {t.home.newArrivals}
            </h2>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/products?sortBy=newest">{t.home.viewAll}</Link>
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500">
            {t.common.loading}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
             {newProducts.map((product: Product) => (
               <ProductCard
                 key={product.id}
                 product={product}
                 favorited={favoriteIds.has(product.id)}
               />
             ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
