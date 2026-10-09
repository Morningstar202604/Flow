import React, { useState } from 'react';
import { Calculator, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calculateShipping } from '@/api/shipping';
import type { ShippingCalculateResponse } from '@shared/api.interface';
import { toast } from 'sonner';

interface ShippingCalculatorProps {
  templateId?: string;
  sellerId?: string;
}

const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({ templateId, sellerId }) => {
  const [formData, setFormData] = useState({
    country: '',
    weightTotal: '',
    qtyTotal: '',
    subtotal: '',
  });
  const [result, setResult] = useState<ShippingCalculateResponse | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const payload: Parameters<typeof calculateShipping>[0] = {};
      if (templateId) payload.templateId = templateId;
      if (sellerId) payload.sellerId = sellerId;
      if (formData.country) payload.country = formData.country;
      if (formData.weightTotal) payload.weightTotal = Number(formData.weightTotal);
      if (formData.qtyTotal) payload.qtyTotal = Number(formData.qtyTotal);
      if (formData.subtotal) payload.subtotal = Number(formData.subtotal);

      const res = await calculateShipping(payload);
      setResult(res);
    } catch {
      toast.error('计算运费失败');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calculator className="h-4 w-4 text-blue-600" />
          运费计算器（预览）
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-500">目的国家</Label>
            <Input
              placeholder="如: US, UK, DE"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">总重量 (kg)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={formData.weightTotal}
              onChange={(e) => handleChange('weightTotal', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">总件数</Label>
            <Input
              type="number"
              placeholder="1"
              value={formData.qtyTotal}
              onChange={(e) => handleChange('qtyTotal', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">订单金额 ($)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={formData.subtotal}
              onChange={(e) => handleChange('subtotal', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleCalculate}
          disabled={calculating}
        >
          {calculating ? '计算中...' : '试算运费'}
        </Button>

        {result && (
          <div className="rounded-lg bg-slate-50 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-slate-600">预估运费：</span>
            </div>
            <div className="text-right">
              {result.isFree ? (
                <span className="text-sm font-medium text-emerald-600">免运费</span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">
                  {result.currency} {result.fee}
                </span>
              )}
              {result.templateName && (
                <div className="text-xs text-slate-400">({result.templateName})</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShippingCalculator;
