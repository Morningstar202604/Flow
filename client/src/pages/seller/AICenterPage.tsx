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
  Settings2,
  Bot,
  Play,
  Pencil,
  Trash2,
  Plus,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Markdown } from '@/components/ui/markdown';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '@/api';
import type {
  AIStatusResponse,
  AITrendReport,
  AISelectResponse,
  AIUsageStats,
  AIReportSummary,
  AIReportDetail,
  AiSettingsView,
  CustomAgent,
  BuiltinAgentMeta,
  UpdateAiSettingsRequest,
} from '@shared/api.interface';
import { toast } from 'sonner';
import { notifyError } from '@/lib/error-feedback';

const PROVIDER_PRESETS: Array<{ label: string; baseUrl: string; model: string }> = [
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  { label: '火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
];

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

  const [reports, setReports] = useState<AIReportSummary[]>([]);
  const [activeReport, setActiveReport] = useState<AIReportDetail | null>(null);

  // —— 模型设置 ——
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null);
  const [settingsForm, setSettingsForm] = useState<{ baseUrl: string; apiKey: string; model: string }>({
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [settingsTesting, setSettingsTesting] = useState<boolean>(false);
  const [settingsTestResult, setSettingsTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // —— 自定义 Agent ——
  const [agents, setAgents] = useState<{ builtin: BuiltinAgentMeta[]; custom: CustomAgent[] }>({
    builtin: [],
    custom: [],
  });
  const [agentDialogOpen, setAgentDialogOpen] = useState<boolean>(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [agentForm, setAgentForm] = useState<{
    name: string;
    slug: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    responseFormat: 'text' | 'json';
    temperature: string;
    maxTokens: string;
    enabled: boolean;
  }>({
    name: '',
    slug: '',
    description: '',
    systemPrompt: '',
    userPromptTemplate: '{{input}}',
    responseFormat: 'text',
    temperature: '0.7',
    maxTokens: '2000',
    enabled: true,
  });
  const [agentSaving, setAgentSaving] = useState<boolean>(false);
  const [runAgentId, setRunAgentId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState<string>('');
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoadingStatus(true);
        const result = await aiApi.getAIStatus();
        setStatus(result);
      } catch (err) {
        notifyError(err, '获取 AI 状态失败');
        setStatus({ configured: false });
      } finally {
        setLoadingStatus(false);
      }
    };
    fetchStatus();
    fetchUsageStats();
    void fetchReports();
    void fetchAiSettings();
    void fetchAgents();
  }, []);

  const fetchReports = async () => {
    try {
      const result = await aiApi.getAIReports('trend');
      setReports(result);
    } catch (err) {
      notifyError(err, '获取历史报告失败');
    }
  };

  const handleViewReport = async (id: string) => {
    try {
      const detail = await aiApi.getAIReport(id);
      setActiveReport(detail);
    } catch (err) {
      notifyError(err, '读取报告失败');
    }
  };

  const fetchAiSettings = async () => {
    try {
      const result = await aiApi.getAiSettings();
      setAiSettings(result);
      setSettingsForm((prev) => ({
        baseUrl: prev.baseUrl || result.baseUrl || '',
        apiKey: prev.apiKey,
        model: prev.model || result.model || '',
      }));
    } catch (err) {
      notifyError(err, '获取模型设置失败');
    }
  };

  const fetchAgents = async () => {
    try {
      setAgents(await aiApi.listAiAgents());
    } catch (err) {
      notifyError(err, '获取 Agent 列表失败');
    }
  };

  const handleSaveAiSettings = async () => {
    try {
      setSettingsSaving(true);
      const payload: UpdateAiSettingsRequest = {};
      if (settingsForm.baseUrl.trim() !== (aiSettings?.baseUrl ?? '')) payload.baseUrl = settingsForm.baseUrl.trim();
      if (settingsForm.model.trim() !== (aiSettings?.model ?? '')) payload.model = settingsForm.model.trim();
      if (settingsForm.apiKey.trim()) payload.apiKey = settingsForm.apiKey.trim();

      const updated = await aiApi.updateAiSettings(payload);
      setAiSettings(updated);
      setSettingsForm({ baseUrl: updated.baseUrl, model: updated.model, apiKey: '' });
      setStatus((prev) => (prev ? { ...prev, configured: updated.configured, model: updated.model } : prev));
      toast('模型设置已保存（立即生效）');
    } catch (err) {
      console.error('保存模型设置失败', err);
      toast('保存失败，请检查填写内容');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!window.confirm('清除界面中保存的 API Key？将回退到环境变量或未配置状态。')) return;
    try {
      const updated = await aiApi.updateAiSettings({ apiKey: '' });
      setAiSettings(updated);
      setStatus((prev) => (prev ? { ...prev, configured: updated.configured, model: updated.model } : prev));
      toast('已清除界面中的 API Key');
    } catch (err) {
      console.error('清除 Key 失败', err);
      toast('清除失败');
    }
  };

  const handleTestAiSettings = async () => {
    try {
      setSettingsTesting(true);
      setSettingsTestResult(null);
      const result = await aiApi.testAiSettings();
      setSettingsTestResult(result);
    } catch (err) {
      console.error('测试连通失败', err);
      setSettingsTestResult({ ok: false, message: '测试请求失败，请稍后再试' });
    } finally {
      setSettingsTesting(false);
    }
  };

  const openCreateAgent = () => {
    setEditingAgent(null);
    setAgentForm({
      name: '',
      slug: '',
      description: '',
      systemPrompt: '',
      userPromptTemplate: '{{input}}',
      responseFormat: 'text',
      temperature: '0.7',
      maxTokens: '2000',
      enabled: true,
    });
    setAgentDialogOpen(true);
  };

  const openEditAgent = (agent: CustomAgent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      userPromptTemplate: agent.userPromptTemplate,
      responseFormat: agent.responseFormat,
      temperature: String(agent.temperature),
      maxTokens: String(agent.maxTokens),
      enabled: agent.enabled,
    });
    setAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    try {
      setAgentSaving(true);
      const payload = {
        name: agentForm.name.trim(),
        description: agentForm.description.trim(),
        systemPrompt: agentForm.systemPrompt,
        userPromptTemplate: agentForm.userPromptTemplate,
        responseFormat: agentForm.responseFormat,
        temperature: Number(agentForm.temperature) || 0.7,
        maxTokens: Number(agentForm.maxTokens) || 2000,
        enabled: agentForm.enabled,
      };

      if (editingAgent) {
        await aiApi.updateAiAgent(editingAgent.id, payload);
      } else {
        await aiApi.createAiAgent({ ...payload, slug: agentForm.slug.trim() || undefined });
      }

      setAgentDialogOpen(false);
      await fetchAgents();
      toast(editingAgent ? 'Agent 已更新' : 'Agent 已创建');
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(message ? String(message) : '保存失败');
    } finally {
      setAgentSaving(false);
    }
  };

  const handleRemoveAgent = async (agent: CustomAgent) => {
    if (!window.confirm(`删除 Agent「${agent.name}」？此操作不可恢复。`)) return;
    try {
      await aiApi.deleteAiAgent(agent.id);
      await fetchAgents();
      toast('Agent 已删除');
    } catch (err) {
      console.error('删除 Agent 失败', err);
      toast('删除失败');
    }
  };

  const handleRunAgent = async (agent: CustomAgent) => {
    try {
      setRunLoading(true);
      setRunOutput(null);
      const result = await aiApi.runAiAgent(agent.id, runInput);
      setRunOutput(result.parsed !== undefined ? JSON.stringify(result.parsed, null, 2) : result.content);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(message ? String(message) : '运行失败');
    } finally {
      setRunLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      setUsageLoading(true);
      const result = await aiApi.getUsageStats();
      setUsageStats(result);
    } catch (err) {
      notifyError(err, '获取 AI 用量统计失败');
    } finally {
      setUsageLoading(false);
    }
  };

  const handleGenerateTrend = async () => {
    try {
      setTrendLoading(true);
      const result = await aiApi.generateTrendReport();
      setTrendReport(result);
      void fetchReports();
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
              AI 功能尚未启用 —— 请填写模型
            </div>
            <div className="text-sm text-amber-800 leading-relaxed space-y-1">
              <p>
                在下方「模型设置」中填写您的模型 API（Base URL / API Key / 模型名），保存后立即生效。
                运维也可通过 LLM_BASE_URL / LLM_API_KEY 环境变量提供默认值（界面设置优先级更高）。
              </p>
              <p className="pt-1 text-amber-700">
                未配置期间，所有 AI 功能会明确提示「请填写模型」，绝不返回假数据。
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

      {/* 模型设置 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-5 w-5 text-slate-600" />
            模型设置
          </CardTitle>
          <CardDescription>
            填写 OpenAI 兼容的模型端点（可一键预填常见服务商），保存后立即生效；不填写也完全可以——除 AI 以外的所有功能不受影响，AI 功能会诚实提示「请填写模型」
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {aiSettings?.configured ? (
              <Badge className="bg-emerald-100 text-emerald-700">已配置</Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                未配置
              </Badge>
            )}
            {aiSettings?.source === 'db' && <span className="text-muted-foreground">来源：界面设置</span>}
            {aiSettings?.source === 'env' && (
              <span className="text-muted-foreground">来源：环境变量（引导默认值）</span>
            )}
            {aiSettings?.apiKeyMasked && (
              <span className="text-muted-foreground">当前 Key：{aiSettings.apiKeyMasked}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">一键预填：</span>
            {PROVIDER_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setSettingsForm((prev) => ({ ...prev, baseUrl: preset.baseUrl, model: preset.model }))
                }
              >
                {preset.label}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">
              （Key 请使用您自己的账号；也可直接手填任意 OpenAI 兼容端点）
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input
                value={settingsForm.baseUrl}
                placeholder="https://api.deepseek.com"
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                value={settingsForm.apiKey}
                placeholder="留空不修改；输入新值覆盖"
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>模型名</Label>
              <Input
                value={settingsForm.model}
                placeholder="deepseek-chat"
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, model: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void handleSaveAiSettings()} disabled={settingsSaving}>
              {settingsSaving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              保存设置
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleTestAiSettings()}
              disabled={settingsTesting}
            >
              {settingsTesting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-1 h-4 w-4" />
              )}
              测试连通（使用已保存配置）
            </Button>
            {aiSettings?.apiKeyMasked && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => void handleClearApiKey()}
              >
                清除界面 Key
              </Button>
            )}
          </div>

          {settingsTestResult && (
            <p className={`text-sm ${settingsTestResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {settingsTestResult.message}
            </p>
          )}
        </CardContent>
      </Card>

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

      {/* 我的 Agent（自定义） */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-indigo-600" />
                我的 Agent
              </CardTitle>
              <CardDescription>
                默认内置 5 个专业 Agent（只读）；可创建任意数量自定义 Agent，保存后即可试跑
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreateAgent}>
              <Plus className="mr-1 h-4 w-4" />
              新建 Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="space-y-2">
            {agents.builtin.map((agent) => (
              <div
                key={agent.key}
                className="flex items-start justify-between rounded-md bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {agent.name}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      内置 · 只读
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {agent.description}（{agent.usesModel}）
                  </div>
                </div>
              </div>
            ))}
          </div>

          {agents.custom.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              暂无自定义 Agent —— 点击右上角「新建 Agent」开始
            </p>
          ) : (
            <div className="space-y-2">
              {agents.custom.map((agent) => (
                <div key={agent.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {agent.name}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{agent.slug}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {agent.responseFormat === 'json' ? 'JSON' : '文本'}
                        </Badge>
                        {!agent.enabled && (
                          <Badge variant="secondary" className="ml-1 text-xs text-slate-500">
                            已停用
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {agent.description || '（无描述）'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="试跑"
                        onClick={() => {
                          setRunAgentId(runAgentId === agent.id ? null : agent.id);
                          setRunOutput(null);
                        }}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="编辑" onClick={() => openEditAgent(agent)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="删除"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => void handleRemoveAgent(agent)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {runAgentId === agent.id && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        rows={3}
                        placeholder="输入内容后点击运行（服务端以 {{input}} 渲染模板并调用模型）"
                        value={runInput}
                        onChange={(e) => setRunInput(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={() => void handleRunAgent(agent)}
                        disabled={runLoading || !runInput.trim()}
                      >
                        {runLoading ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-4 w-4" />
                        )}
                        运行
                      </Button>
                      {runOutput && (
                        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                          {runOutput}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史报告（落库回看） */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-slate-500" />
            历史报告
          </CardTitle>
          <CardDescription>已生成的趋势报告会落库保存，可随时回看</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {reports.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无历史报告</p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {report.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString('zh-CN')}
                      {report.model ? ` · ${report.model}` : ''}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleViewReport(report.id)}
                  >
                    查看
                  </Button>
                </div>
              ))}
            </div>
          )}
          {activeReport && (
            <div className="mt-4 rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  {activeReport.title}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setActiveReport(null)}>
                  收起
                </Button>
              </div>
              <div className="prose prose-sm max-w-none">
                <Markdown>{activeReport.content}</Markdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
      {/* Agent 新建/编辑对话框 */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? '编辑 Agent' : '新建 Agent'}</DialogTitle>
            <DialogDescription>
              系统提示词定义角色与规则；用户模板中的 {'{{input}}'} 会被运行时输入替换（缺占位符时输入追加在末尾）
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>名称 *</Label>
                <Input
                  value={agentForm.name}
                  placeholder="如：差评回复助手"
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>标识 slug（可选）</Label>
                <Input
                  value={agentForm.slug}
                  placeholder="review-helper（小写字母/数字/连字符）"
                  disabled={!!editingAgent}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, slug: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input
                value={agentForm.description}
                placeholder="这个 Agent 做什么（展示用）"
                onChange={(e) => setAgentForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>系统提示词 *</Label>
              <Textarea
                rows={5}
                value={agentForm.systemPrompt}
                placeholder="你是……，请遵守以下规则：……"
                onChange={(e) => setAgentForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>用户提示词模板</Label>
              <Textarea
                rows={3}
                value={agentForm.userPromptTemplate}
                placeholder="{{input}}"
                onChange={(e) => setAgentForm((prev) => ({ ...prev, userPromptTemplate: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>输出格式</Label>
                <div className="flex gap-1 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={agentForm.responseFormat === 'text' ? 'default' : 'outline'}
                    onClick={() => setAgentForm((prev) => ({ ...prev, responseFormat: 'text' }))}
                  >
                    文本
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={agentForm.responseFormat === 'json' ? 'default' : 'outline'}
                    onClick={() => setAgentForm((prev) => ({ ...prev, responseFormat: 'json' }))}
                  >
                    JSON
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>temperature</Label>
                <Input
                  value={agentForm.temperature}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, temperature: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>maxTokens</Label>
                <Input
                  value={agentForm.maxTokens}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, maxTokens: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={agentForm.enabled}
                onCheckedChange={(value) => setAgentForm((prev) => ({ ...prev, enabled: value }))}
              />
              <span className="text-sm text-slate-700">启用</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void handleSaveAgent()}
              disabled={agentSaving || !agentForm.name.trim() || !agentForm.systemPrompt.trim()}
            >
              {agentSaving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AICenterPage;
