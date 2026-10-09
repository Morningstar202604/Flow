import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Product, ProductVariant } from '@shared/api.interface';

interface VariantSelectorProps {
  product: Product;
  selectedId: string | null;
  onSelect: (variant: ProductVariant) => void;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({
  product,
  selectedId,
  onSelect,
}) => {
  const { optionNames, variants } = product;

  if (variants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {optionNames.map((optionName: string, dimensionIdx: number) => {
        // Collect unique values for this dimension
        const values: string[] = [];
        variants.forEach((variant: ProductVariant) => {
          const val = variant.optionValues[dimensionIdx];
          if (val && !values.includes(val)) {
            values.push(val);
          }
        });

        if (values.length === 0) return null;

        return (
          <div key={dimensionIdx}>
            <div className="text-sm font-medium text-slate-700 mb-1.5">
              {optionName}
            </div>
            <div className="flex flex-wrap gap-2">
              {values.map((value: string) => {
                // Find the variant that matches this value in this dimension
                // by also considering previously selected dimensions
                const matchingVariant: ProductVariant | undefined = variants.find(
                  (v: ProductVariant) => v.optionValues[dimensionIdx] === value,
                );

                const isSelected: boolean = selectedId === matchingVariant?.id;
                const isAvailable: boolean = matchingVariant
                  ? matchingVariant.stock > 0
                  : false;

                return (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    disabled={!isAvailable}
                    className={cn(
                      'min-w-[3rem]',
                      isSelected &&
                        'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500',
                      !isAvailable && 'opacity-40 cursor-not-allowed line-through',
                    )}
                    onClick={() => {
                      if (matchingVariant) {
                        onSelect(matchingVariant);
                      }
                    }}
                  >
                    {value}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Show selected variant details */}
      {selectedId && (() => {
        const selected = variants.find((v: ProductVariant) => v.id === selectedId);
        if (!selected) return null;
        return (
          <div className="text-sm text-slate-500 mt-1">
            {selected.sku && (
              <span className="mr-3">
                SKU: <span className="font-mono">{selected.sku}</span>
              </span>
            )}
            <span>
              {selected.stock > 0
                ? `${selected.stock} in stock`
                : 'Out of stock'}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

export default VariantSelector;
