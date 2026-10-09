import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, AlertCircle } from 'lucide-react';
import { createRefund } from '@/api/refunds';
import type { Order } from '@shared/api.interface';
import { toast } from 'sonner';
import { Image } from '@/components/ui/image';

interface RefundRequestModalProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REFUND_REASONS = [
  { value: 'quality_issue', label: '商品质量问题' },
  { value: 'wrong_item', label: '发错商品' },
  { value: 'not_as_described', label: '商品与描述不符' },
  { value: 'damaged', label: '商品损坏/破损' },
  { value: 'missing_parts', label: '缺少配件/零件' },
  { value: 'changed_mind', label: '不想要了/改变主意' },
  { value: 'delivery_too_slow', label: '物流太慢' },
  { value: 'other', label: '其他原因' },
];

const RefundRequestModal: React.FC<RefundRequestModalProps> = ({
  order,
  open,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState(String(Number(order.totalAmount).toFixed(2)));
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [refundMethod, setRefundMethod] = useState('original');
  const [submitting, setSubmitting] = useState(false);

  const maxRefund = Number(order.totalAmount);

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('请输入有效的退款金额');
      return;
    }
    if (numAmount > maxRefund) {
      toast.error(`退款金额不能超过订单总额 $${maxRefund.toFixed(2)}`);
      return;
    }
    if (!reason) {
      toast.error('请选择退款原因');
      return;
    }

    setSubmitting(true);
    try {
      await createRefund({
        orderId: order.id,
        amount: numAmount,
        reason,
        reasonDetail: reasonDetail.trim() || undefined,
        refundMethod,
      });
      toast.success('退款申请已提交，请等待商家处理');
      onSuccess();
      onClose();
      // Reset form
      setAmount(String(Number(order.totalAmount).toFixed(2)));
      setReason('');
      setReasonDetail('');
    } catch {
      toast.error('提交退款申请失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            申请退款
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 订单信息 */}
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">订单信息</span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>订单号：<span className="font-mono text-slate-700">{order.orderNo}</span></div>
              <div>订单总额：<span className="font-semibold text-slate-900">${Number(order.totalAmount).toFixed(2)}</span></div>
            </div>
          </div>

          {/* 退款商品 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">退款商品</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto rounded-lg border p-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  {item.productImage && (
                    <Image src={item.productImage} alt="" className="h-8 w-8 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-700 truncate">{item.productTitle}</div>
                    <div className="text-xs text-slate-400">x{item.quantity}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">${item.subtotal}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* 退款金额 */}
          <div>
            <Label htmlFor="refund-amount" className="text-sm font-medium">
              退款金额 <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={String(maxRefund)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">最高可退 ${maxRefund.toFixed(2)}</p>
          </div>

          {/* 退款原因 */}
          <div>
            <Label className="text-sm font-medium">
              退款原因 <span className="text-red-500">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="请选择退款原因" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 补充说明 */}
          <div>
            <Label htmlFor="refund-detail" className="text-sm font-medium">补充说明</Label>
            <Textarea
              id="refund-detail"
              placeholder="请详细描述您的退款原因（选填）"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* 退款方式 */}
          <div>
            <Label className="text-sm font-medium">退款方式</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">原路返回</SelectItem>
                <SelectItem value="balance">退至余额</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? '提交中...' : '提交申请'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefundRequestModal;
