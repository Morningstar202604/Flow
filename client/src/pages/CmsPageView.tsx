import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPageBySlug } from '@/api/cms';
import type { CmsPage } from '@shared/api.interface';
import DOMPurify from 'dompurify';

const CmsPageView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    const fetchPage = async () => {
      try {
        setLoading(true);
        const data = await getPageBySlug(slug!);
        if (!cancelled) {
          setPage(data);
        }
      } catch {
        if (!cancelled) {
          setPage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPage();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <FileText className="size-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">页面不存在</h1>
          <p className="text-sm text-slate-500 mb-6">您访问的页面可能已被删除或不存在</p>
          <Button variant="outline" asChild>
            <a href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回首页
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const displayTitle = language === 'zh' ? page.titleZh : page.titleEn;
  const displayContent = language === 'zh' ? page.contentZh : page.contentEn;

  // Sanitize HTML content
  const cleanContent = DOMPurify.sanitize(displayContent || '', {
    ADD_TAGS: ['iframe', 'img'],
    ADD_ATTR: ['target', 'rel'],
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">{displayTitle}</h1>

        {/* Content */}
        <div
          className="prose prose-slate prose-lg max-w-none
            [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
            [&_li]:text-slate-600 [&_li]:mb-1
            [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800
            [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-6
            [&_blockquote]:border-l-4 [&_blockquote]:border-blue-200 [&_blockquote]:bg-blue-50 [&_blockquote]:rounded-r-lg [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic
            [&_code]:bg-slate-100 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono
            [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto
            [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
            [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left
            [&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-2
            [&_hr]:border-slate-200 [&_hr]:my-8
          "
          dangerouslySetInnerHTML={{ __html: cleanContent }}
        />

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            最后更新：{page.updatedAt ? new Date(page.updatedAt).toLocaleString('zh-CN') : '-'}
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/">
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回首页
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CmsPageView;
