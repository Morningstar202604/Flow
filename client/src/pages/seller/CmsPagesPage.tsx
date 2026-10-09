import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCmsPages,
  getCmsPageDetail,
  createCmsPage,
  updateCmsPage,
  deleteCmsPage,
} from '@/api/cms';
import RichTextEditor from '@/components/RichTextEditor';
import type {
  CmsPage,
  CreateCmsPageRequest,
  UpdateCmsPageRequest,
} from '@shared/api.interface';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

const statusMeta: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '草稿', variant: 'secondary' as const },
  published: { label: '已发布', variant: 'default' as const },
  archived: { label: '已归档', variant: 'outline' as const },
};

const CmsPagesPage: React.FC = () => {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCmsPageRequest>({
    slug: '',
    title: '',
    content: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCmsPages({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      } as Parameters<typeof getCmsPages>[0]);
      setPages(result.items);
      setTotal(result.total);
    } catch {
      toast.error('加载页面失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, statusFilter]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleSearch = () => {
    setPage(1);
    fetchPages();
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm({ slug: '', title: '', content: '', status: 'draft' });
    setDialogOpen(true);
  };

  const handleEdit = async (cmsPage: CmsPage) => {
    setEditingId(cmsPage.id);
    setFormLoading(true);
    try {
      const detail = await getCmsPageDetail(cmsPage.id);
      setForm({
        slug: detail.slug,
        title: detail.title,
        content: detail.content,
        excerpt: detail.excerpt,
        metaTitle: detail.metaTitle,
        metaDescription: detail.metaDescription,
        coverImage: detail.coverImage,
        status: detail.status,
        isPublic: detail.isPublic,
        sortOrder: detail.sortOrder,
      });
      setDialogOpen(true);
    } catch {
      toast.error('加载页面详情失败');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该页面？此操作不可恢复。')) return;
    try {
      await deleteCmsPage(id);
      toast.success('页面已删除');
      fetchPages();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('请输入页面标题');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('请输入页面标识');
      return;
    }
    try {
      if (editingId) {
        const updatePayload: UpdateCmsPageRequest = { ...form };
        await updateCmsPage(editingId, updatePayload);
        toast.success('页面更新成功');
      } else {
        await createCmsPage(form);
        toast.success('页面创建成功');
      }
      setDialogOpen(false);
      fetchPages();
    } catch {
      toast.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const handleTogglePublish = async (cmsPage: CmsPage) => {
    const newStatus = cmsPage.status === 'published' ? 'draft' : 'published';
    try {
      await updateCmsPage(cmsPage.id, { status: newStatus });
      toast.success(newStatus === 'published' ? '页面已发布' : '已设为草稿');
      fetchPages();
    } catch {
      toast.error('操作失败');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">CMS 页面管理</h2>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          创建页面
        </Button>
      </div>

      {/* Filter */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Input
            placeholder="搜索页面标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-56"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} variant="secondary" size="sm">搜索</Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>公开</TableHead>
                <TableHead>浏览量</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">加载中...</TableCell>
                </TableRow>
              )}
              {!loading && pages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-0">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><FileText className="size-6" /></EmptyMedia>
                        <EmptyTitle>暂无页面</EmptyTitle>
                        <EmptyDescription>创建自定义页面，如关于我们、帮助中心等</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                pages.map((cmsPage) => (
                  <TableRow key={cmsPage.id}>
                    <TableCell className="font-medium text-slate-900">{cmsPage.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">/{cmsPage.slug}</TableCell>
                    <TableCell>
                      <Badge variant={statusMeta[cmsPage.status]?.variant || 'secondary'}>
                        {statusMeta[cmsPage.status]?.label || cmsPage.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cmsPage.isPublic ? (
                        <Eye className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{cmsPage.viewCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cmsPage.updatedAt ? new Date(cmsPage.updatedAt).toLocaleDateString('zh-CN') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleTogglePublish(cmsPage)}>
                          {cmsPage.status === 'published' ? (
                            <EyeOff className="mr-1 h-3 w-3" />
                          ) : (
                            <Eye className="mr-1 h-3 w-3" />
                          )}
                          {cmsPage.status === 'published' ? '取消发布' : '发布'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(cmsPage)}>
                          <Edit className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(cmsPage.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="text-sm text-muted-foreground">
                共 {total} 条，第 {page}/{totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑页面' : '创建页面'}</DialogTitle>
          </DialogHeader>
          {formLoading ? (
            <div className="py-12 text-center text-slate-500">加载中...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>页面标题 *</Label>
                  <Input
                    placeholder="如：关于我们"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>标识 (slug) *</Label>
                  <Input
                    placeholder="如：about-us"
                    value={form.slug}
                    onChange={(e) => {
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                      setForm((prev) => ({ ...prev, slug }));
                    }}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Rich Text Editor */}
              <div>
                <Label>页面内容 *</Label>
                <div className="mt-1">
                  <RichTextEditor
                    value={form.content}
                    onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                    placeholder="在此输入页面内容..."
                  />
                </div>
              </div>

              <div>
                <Label>摘要</Label>
                <Textarea
                  placeholder="页面摘要（选填，用于SEO和列表展示）"
                  value={form.excerpt || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SEO 标题</Label>
                  <Input
                    placeholder="留空则使用页面标题"
                    value={form.metaTitle || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metaTitle: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>状态</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v as CmsPage['status'] }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="published">已发布</SelectItem>
                      <SelectItem value="archived">已归档</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>SEO 描述</Label>
                <Textarea
                  placeholder="SEO meta description（选填）"
                  value={form.metaDescription || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, metaDescription: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>封面图片 URL</Label>
                <Input
                  placeholder="https://..."
                  value={form.coverImage || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-public"
                    checked={form.isPublic || false}
                    onChange={(e) => setForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor="is-public" className="mb-0 cursor-pointer">公开访问（无需登录）</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="mb-0">排序：</Label>
                  <Input
                    type="number"
                    value={form.sortOrder || 0}
                    onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editingId ? '保存修改' : '创建页面'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CmsPagesPage;
