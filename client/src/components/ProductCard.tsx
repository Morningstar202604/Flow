import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toggleFavorite } from '@/api/favorites';
import { toast } from 'sonner';
import type { Product } from '@shared/api.interface';
import { getProductTitle } from '@/utils/product-i18n';

interface ProductCardProps {
  product: Product;
  favorited?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, favorited = false }) => {
  const { language, t } = useLanguage();
  const productText = t.product;

  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState<boolean>(favorited);
  const [favLoading, setFavLoading] = useState<boolean>(false);

  const title: string = getProductTitle(product, language);

  const minPrice: string = product.minPrice ?? '0';
  const displayOriginalPrice: string =
    product.variants[0]?.originalPrice ?? minPrice;
  const isOnSale: boolean =
    !!displayOriginalPrice && Number(displayOriginalPrice) > Number(minPrice);

  const handleToggleFavorite = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error(t.auth.loginToContinue);
      return;
    }
    try {
      setFavLoading(true);
      const result = await toggleFavorite(product.id);
      setIsFavorited(result.favorited);
    } catch (error: unknown) {
      console.error('[productCard] toggle favorite error', error);
      toast.error(t.common.error);
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <Link to={`/products/${product.id}`}>
      <Card className="overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 h-full">
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          <Image
            src={product.coverImage || product.images?.[0] || ''}
            alt={title}
            className="w-full h-full object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />
          {isOnSale && (
            <Badge className="absolute top-2 left-2 bg-orange-500 hover:bg-orange-500">
              -
              {Math.round(
                ((Number(displayOriginalPrice) - Number(minPrice)) /
                  Number(displayOriginalPrice)) *
                  100,
              )}
              %
            </Badge>
          )}
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            className="absolute top-2 right-2 size-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white transition-colors backdrop-blur-sm"
            title={isFavorited ? t.product.removeFromFavorites : t.product.addToFavorites}
          >
            <Heart
              className={`size-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
            />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug min-h-[2.5rem]">
            {title}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-orange-500">
              ${Number(minPrice).toFixed(2)}
            </span>
            {isOnSale && displayOriginalPrice && (
              <span className="text-xs text-slate-400 line-through">
                ${Number(displayOriginalPrice).toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {productText.sold}: {product.totalSold}
          </div>
          {product.totalStock === 0 && (
            <div className="text-xs text-slate-400">
              {productText.outOfStock}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};

export default ProductCard;
