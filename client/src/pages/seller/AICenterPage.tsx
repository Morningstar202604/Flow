import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  MessageSquareText,
  TrendingUp,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Loader2,
  BarChart3,
  Clock,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Markdown } from '@/components/ui/markdown';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '@/api';
import type {
  AIStatusResponse,
  AITrendReport,
  AISelectResponse,
  AIUsageStats,
} from '@shared/api.interface';
import { toast } from 'sonner';

const AICenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AIStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const [trendReport, setTrendReport] = useState<AITrendReport | null>(null);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);

  const [selectResult, setSelectResult] = useState<AISelectResponse | null>(null);
  const [selectLoading, setSelectLoading] = useState<boolean>(false);

  const [usageStats, setUsageStats] = useState<AIUsageStats | null>(null);
  const [usageLoading, setUsageLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoadingStatus(true);
        const result = await aiApi.getAIStatus();
        setStatus(result);
      } catch (err) {
        console.error('获取 AI 状态失败', err);
        setStatus({ configured: false });
      } finally {
        setLoadingStatus(false);
      }
    };
    fetchStatus();
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      setUsageLoading(true);
      const result = await aiApi.getUsageStats();
      setUsageStats(result);
    } catch (err) {
      console.error('获取 AI 用量统计失败', err);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleGenerateTrend = async () => {
    try {
      setTrendLoading(true);
      const result = await aiApi.generateTrendReport();
      setTrendReport(result);
    } catch (err) {
      console.error('生成趋势报告失败', err);
      toast('生成失败，请检查 AI 配置');
    } finally {
      setTrendLoading(false);
    }
  };

  const handleGenerateSelect = async () => {
    try {
      setSelectLoading(true);
      const result = await aiApi.generateSelectSuggestion();
      setSelectResult(result);
    } catch (err) {
      console.error('生成选品建议失败', err);
      toast('生成失败，请检查 AI 配置');
    } finally {
      setSelectLoading(false);
    }
  };

  const featureCards = [
    {
      title: 'AI 文案生成',
      description: '一键生成多语言商品标题、卖点和描述，提升转化率',
      icon: Sparkles,
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-600',
      actionLabel: '前往使用',
      onClick: () => navigate('/seller/products'),
    },
    {
      title: '智能客服配置',
      description: 'AI 自动回复买家咨询，7x24 小时在线服务',
      icon: MessageSquareText,
      color: 'from-indigo-500 to-blue-600',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      actionLabel: '前往咨询管理',
      onClick: () => navigate('/seller/inquiries'),
    },
    {
      title: '市场趋势分析',
      description: 'AI 分析全球市场动态，生成趋势简报',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      actionLabel: trendReport ? '重新生成' : '生成趋势简报',
      onClick: handleGenerateTrend,
      loading: trendLoading,
    },
    {
      title: '选品建议',
      description: '基于市场数据 AI 推荐热门选品方向',
      icon: Lightbulb,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      actionLabel: selectResult ? '重新推荐' : '帮我选品',
      onClick: handleGenerateSelect,
      loading: selectLoading,
    },
  ];

  return (
    <div className="space-y-6">
      {/* AI 配置状态提示 */}
      {!loadingStatus && !status?.configured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-base mb-1">
              ⚠️ AI 功能尚未启用
            </div>
            <div className="text-sm text-amber-800 leading-relaxed space-y-1">
              <p>请在后端环境变量中配置以下参数后刷新页面：</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                <li>
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    LLM_BASE_URL
                  </code>
                  {' '}- API 地址（OpenAI 兼容协议）
                </li>
                <li>
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    LLM_API_KEY
                  </code>
                  {' '}- API 密钥
                </li>
                <li>
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    LLM_MODEL
                  </code>
                  {' '}- 模型名称（可选，默认 deepseek-chat）
                </li>
              </ul>
              <p className="pt-1 text-amber-700">
                当前为演示环境，AI 生成暂不可用。您仍可浏览其他功能。
              </p>
            </div>
          </div>
        </div>
      )}

      {!loadingStatus && status?.configured && (
        <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-violet-800">
          <Sparkles className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">AI 功能已启用</div>
            <div className="text-sm text-violet-700">
              当前模型：{status.model || '默认模型'}
            </div>
          </div>
          <Badge variant="default" className="bg-violet-600">
            已配置
          </Badge>
        </div>
      )}

      {/* 用量统计 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            AI 用量统计
          </CardTitle>
          <CardDescription>累计调用量与资源消耗</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {usageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usageStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-ai-section-type="card-stat">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    总调用次数
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {usageStats.totalCalls.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    总耗时(秒)
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {(usageStats.totalDurationMs / 1000).toFixed(1)}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    Token 总量
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {(usageStats.totalInputTokens + usageStats.totalOutputTokens).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    成功率
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {(usageStats.successRate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              {usageStats.byAgent.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    按 Agent 分布
                  </div>
                  <div className="space-y-2">
                    {usageStats.byAgent.map((stat) => (
                      <div
                        key={stat.agent}
                        className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-slate-700 capitalize">
                          {stat.agent}
                        </span>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{stat.calls} 次</span>
                          <span>{stat.inputTokens + stat.outputTokens} tokens</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 功能卡片网格 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {featureCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card
              key={index}
              className="cursor-pointer overflow-hidden shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-xl ${card.bgColor}`}
                  >
                    <Icon className={`h-7 w-7 ${card.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {card.description}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={card.onClick}
                      disabled={card.loading}
                      className="mt-3"
                    >
                      {card.loading ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          {card.actionLabel}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 趋势报告结果 */}
      {trendReport && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              {trendReport.title || '市场趋势简报'}
            </CardTitle>
            <CardDescription>
              生成时间：{new Date(trendReport.createdAt).toLocaleString('zh-CN')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="prose prose-sm max-w-none">
              <Markdown>{trendReport.content}</Markdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 选品建议结果 */}
      {selectResult && selectResult.items.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              AI 选品推荐
            </CardTitle>
            <CardDescription>
              基于市场数据分析的 {selectResult.items.length} 个选品方向
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {selectResult.items.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border p-4 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      {index + 1}. {item.keyword}
                    </h4>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <span className="text-muted-foreground">
                        预估需求：
                        <span className="font-medium text-slate-700">
                          {item.estimatedDemand}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        建议价格：
                        <span className="font-medium text-slate-700">
                          {item.suggestedPriceRange}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      item.confidence >= 0.8
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.confidence >= 0.6
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }
                  >
                    置信度 {Math.round(item.confidence * 100)}%
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.reason}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AICenterPage;
