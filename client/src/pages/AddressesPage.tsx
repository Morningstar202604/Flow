import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit, Trash2, MapPin, Star, Home, Building } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '@/api/addresses';
import type {
  Address,
  CreateAddressRequest,
  UpdateAddressRequest,
} from '@shared/api.interface';
import { toast } from 'sonner';

const AddressesPage: React.FC = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm: CreateAddressRequest = {
    label: '',
    receiverName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    isDefault: false,
  };

  const [form, setForm] = useState<CreateAddressRequest>(emptyForm);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const items = await getAddresses();
      setAddresses(items);
    } catch {
      toast.error('加载地址列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const handleEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({
      label: address.label,
      receiverName: address.receiverName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该收货地址？')) return;
    try {
      await deleteAddress(id);
      toast.success('地址已删除');
      fetchAddresses();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id);
      toast.success('已设为默认地址');
      fetchAddresses();
    } catch {
      toast.error('设置失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.receiverName.trim()) {
      toast.error('请输入收件人姓名');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('请输入联系电话');
      return;
    }
    if (!form.addressLine1.trim()) {
      toast.error('请输入详细地址');
      return;
    }
    if (!form.city.trim()) {
      toast.error('请输入城市');
      return;
    }
    if (!form.country.trim()) {
      toast.error('请输入国家');
      return;
    }

    try {
      if (editingId) {
        const updatePayload: UpdateAddressRequest = { ...form };
        delete updatePayload.isDefault;
        await updateAddress(editingId, updatePayload);
        toast.success('地址更新成功');
      } else {
        await createAddress(form);
        toast.success('地址创建成功');
      }
      setDialogOpen(false);
      fetchAddresses();
    } catch {
      toast.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const getLabelIcon = (label?: string) => {
    const l = label?.toLowerCase() || '';
    if (l.includes('home') || l === '家' || l === '住宅') return <Home className="h-4 w-4" />;
    if (l.includes('office') || l === '公司' || l === '办公') return <Building className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">收货地址</h1>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4" />
            添加地址
          </Button>
        </div>

        {addresses.length === 0 ? (
          <Card className="rounded-xl bg-white">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><MapPin className="size-6" /></EmptyMedia>
                <EmptyTitle>暂无收货地址</EmptyTitle>
                <EmptyDescription>添加收货地址，下单时快速选择</EmptyDescription>
              </EmptyHeader>
              <div className="mt-4">
                <Button onClick={handleCreate}>
                  <Plus className="mr-1 h-4 w-4" />
                  添加地址
                </Button>
              </div>
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addresses.map((address) => (
              <Card
                key={address.id}
                className={`rounded-xl bg-white transition-all hover:shadow-md ${
                  address.isDefault ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getLabelIcon(address.label)}
                      <span className="text-sm font-medium text-slate-700">
                        {address.label || '收货地址'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {address.isDefault && (
                        <Badge variant="default" className="text-xs">默认</Badge>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{address.receiverName}</span>
                      <span className="text-slate-400">{address.phone}</span>
                    </div>
                    <div className="text-slate-600">
                      {address.addressLine1}
                      {address.addressLine2 && <span>，{address.addressLine2}</span>}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {[address.city, address.state, address.zipCode, address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleEdit(address)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(address.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        删除
                      </Button>
                    </div>
                    {!address.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(address.id)}
                      >
                        <Star className="mr-1 h-3 w-3" />
                        设为默认
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Add new card */}
            <Card className="rounded-xl bg-white border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors cursor-pointer flex items-center justify-center min-h-[180px]"
              onClick={handleCreate}
            >
              <CardContent className="text-center py-6">
                <Plus className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <div className="text-sm text-slate-400">添加新地址</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑地址' : '添加地址'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>地址标签</Label>
              <div className="flex gap-2 mt-1">
                {['家', '公司', '其他'].map((label) => (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={form.label === label ? 'default' : 'outline'}
                    onClick={() => setForm((prev) => ({ ...prev, label }))}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>收件人 *</Label>
                <Input
                  placeholder="收件人姓名"
                  value={form.receiverName}
                  onChange={(e) => setForm((prev) => ({ ...prev, receiverName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>联系电话 *</Label>
                <Input
                  placeholder="电话号码"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>详细地址 *</Label>
              <Input
                placeholder="街道、门牌号等"
                value={form.addressLine1}
                onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>地址补充</Label>
              <Input
                placeholder="公寓、楼层等（选填）"
                value={form.addressLine2 || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>城市 *</Label>
                <Input
                  placeholder="城市"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>州/省</Label>
                <Input
                  placeholder="州/省（选填）"
                  value={form.state || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>邮编</Label>
                <Input
                  placeholder="邮政编码（选填）"
                  value={form.zipCode || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, zipCode: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>国家 *</Label>
                <Input
                  placeholder="如：CN, US, UK"
                  value={form.country}
                  onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {!editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="set-default"
                  checked={form.isDefault || false}
                  onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <Label htmlFor="set-default" className="mb-0 cursor-pointer">设为默认地址</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingId ? '保存' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddressesPage;
