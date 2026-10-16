import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import ProductCard from '@/components/ProductCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { listProducts } from '@/api/products';
import { listCategories } from '@/api/categories';
import { checkFavoriteBatch } from '@/api/favorites';
import type {
  Product,
  Category,
  ProductListParams,
} from '@shared/api.interface';
import { notifyError } from '@/lib/error-feedback';

type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'sold_desc';

const ProductListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const [keyword, setKeyword] = useState<string>(
    searchParams.get('keyword') || '',
  );
  const [searchInput, setSearchInput] = useState<string>(
    searchParams.get('keyword') || '',
  );
  const [categoryId, setCategoryId] = useState<string>(
    searchParams.get('category') || '',
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    (searchParams.get('sortBy') as SortBy) || 'newest',
  );
  const [page, setPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10),
  );
  const [minPrice, setMinPrice] = useState<string>(
    searchParams.get('minPrice') || '',
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    searchParams.get('maxPrice') || '',
  );
  const pageSize: number = 12;

  const fetchProducts = useCallback(async (): Promise<void> => {
    const params: ProductListParams = {
      page,
      pageSize,
      sortBy: sortBy as ProductListParams['sortBy'],
    };
    if (categoryId) params.categoryId = categoryId;
    if (keyword) params.keyword = keyword;
    if (minPrice) params.minPrice = Number(minPrice);
    if (maxPrice) params.maxPrice = Number(maxPrice);

     try {
       setLoading(true);
       const data = await listProducts(params);
       setProducts(data.items);
       setTotal(data.total);
       if (user && data.items.length > 0) {
         try {
           const ids = data.items.map((p) => p.id);
           const faves = await checkFavoriteBatch(ids);
           setFavoriteIds(new Set(faves));
         } catch (favErr) {
           console.error('[productList] favorites error', favErr);
         }
       }
     } catch (error: unknown) {
      notifyError(error, tRef.current.common.error);
    } finally {
      setLoading(false);
    }
   }, [page, pageSize, sortBy, categoryId, keyword, minPrice, maxPrice, user]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const cats = await listCategories();
        setCategories(cats);
      } catch (error: unknown) {
        notifyError(error, tRef.current.common.error);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const updateUrl = (updates: Record<string, string>): void => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]: [string, string]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    navigate(`/products?${params.toString()}`);
  };

  const handleSearch = (): void => {
    setKeyword(searchInput);
    setPage(1);
    updateUrl({ keyword: searchInput, page: '1' });
  };

  const handleCategoryChange = (id: string): void => {
    setCategoryId(id);
    setPage(1);
    updateUrl({ category: id, page: '1' });
  };

  const handleSortChange = (value: string): void => {
    setSortBy(value as SortBy);
    updateUrl({ sortBy: value });
  };

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
    updateUrl({ page: String(newPage) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePriceApply = (): void => {
    setPage(1);
    updateUrl({ minPrice, maxPrice, page: '1' });
  };

  const totalPages: number = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filter */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Card className="rounded-xl p-4 space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <SlidersHorizontal className="size-4" />
                  {t.common.allCategories}
                </h3>
                <div className="space-y-1">
                  <button
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !categoryId
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => handleCategoryChange('')}
                  >
                    {t.common.allCategories}
                  </button>
                  {categories.map((cat: Category) => {
                    const name: string =
                      language === 'zh' ? cat.nameZh : cat.nameEn;
                    return (
                      <button
                        key={cat.id}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          categoryId === cat.id
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => handleCategoryChange(cat.id)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-900 mb-3">
                  {t.common.priceRange}
                </h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t.common.minPrice}
                      value={minPrice}
                      onChange={(
                        e: React.ChangeEvent<HTMLInputElement>,
                      ) => setMinPrice(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      placeholder={t.common.maxPrice}
                      value={maxPrice}
                      onChange={(
                        e: React.ChangeEvent<HTMLInputElement>,
                      ) => setMaxPrice(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handlePriceApply}
                  >
                    {t.common.apply}
                  </Button>
                </div>
              </div>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search & Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder={t.nav.searchPlaceholder}
                  value={searchInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchInput(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} variant="secondary">
                  {t.common.search}
                </Button>
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t.common.sortBy} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t.common.newest}</SelectItem>
                    <SelectItem value="price_asc">
                      {t.common.priceAsc}
                    </SelectItem>
                    <SelectItem value="price_desc">
                      {t.common.priceDesc}
                    </SelectItem>
                    <SelectItem value="sold_desc">
                      {t.common.bestSelling}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-slate-500 mb-4">
              {total} {t.common.results}
            </div>

            {/* Product Grid */}
            {loading ? (
              <div className="text-center py-20 text-slate-500">
                {t.common.loading}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                {t.common.noResults}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {products.map((product: Product) => (
                   <ProductCard
                     key={product.id}
                     product={product}
                     favorited={favoriteIds.has(product.id)}
                   />
                 ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          page > 1 && handlePageChange(page - 1)
                        }
                        className={
                          page <= 1
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i: number) => i + 1)
                      .slice(
                        Math.max(0, page - 3),
                        Math.min(totalPages, page + 2),
                      )
                      .map((p: number) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => handlePageChange(p)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          page < totalPages && handlePageChange(page + 1)
                        }
                        className={
                          page >= totalPages
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductListPage;
