import { http } from '../lib/http';
import type {
  CopilotActionResolveResult,
  CopilotBatchResolveResult,
  CopilotConversation,
  CopilotConversationDetail,
  CopilotInsightThresholds,
  CopilotInsightsView,
  CopilotSendResult,
  CopilotToolsView,
  ShopperDemandGap,
  ShopperFunnelResponse,
  ShopperProductFunnelResponse,
  UpdateCopilotInsightThresholdsRequest,
} from '@shared/api.interface';

export async function getCopilotTools(): Promise<CopilotToolsView> {
  const { data } = await http.get<CopilotToolsView>('/api/copilot/tools');
  return data;
}

export async function listCopilotConversations(): Promise<CopilotConversation[]> {
  const { data } = await http.get<CopilotConversation[]>('/api/copilot/conversations');
  return data;
}

export async function createCopilotConversation(title?: string): Promise<CopilotConversation> {
  const { data } = await http.post<CopilotConversation>('/api/copilot/conversations', { title });
  return data;
}

export async function getCopilotConversation(id: string): Promise<CopilotConversationDetail> {
  const { data } = await http.get<CopilotConversationDetail>(`/api/copilot/conversations/${id}`);
  return data;
}

export async function deleteCopilotConversation(id: string): Promise<{ success: boolean }> {
  const { data } = await http.delete<{ success: boolean }>(`/api/copilot/conversations/${id}`);
  return data;
}

export async function sendCopilotMessage(id: string, content: string): Promise<CopilotSendResult> {
  const { data } = await http.post<CopilotSendResult>(`/api/copilot/conversations/${id}/messages`, { content });
  return data;
}

export async function resolveCopilotAction(
  id: string,
  approve: boolean,
  reason?: string,
): Promise<CopilotActionResolveResult> {
  const { data } = await http.post<CopilotActionResolveResult>(`/api/copilot/actions/${id}/resolve`, {
    approve,
    reason,
  });
  return data;
}

export async function getCopilotActionImpact(id: string): Promise<string> {
  const { data } = await http.get<{ impact: string }>(`/api/copilot/actions/${id}/impact`);
  return data.impact;
}

export async function resolveCopilotBatch(
  batchId: string,
  approve: boolean,
  reason?: string,
): Promise<CopilotBatchResolveResult> {
  const { data } = await http.post<CopilotBatchResolveResult>(
    `/api/copilot/batches/${batchId}/resolve`,
    { approve, reason },
  );
  return data;
}

export async function getCopilotInsights(): Promise<CopilotInsightsView> {
  const { data } = await http.get<CopilotInsightsView>('/api/copilot/insights');
  return data;
}

export async function getCopilotInsightThresholds(): Promise<CopilotInsightThresholds> {
  const { data } = await http.get<CopilotInsightThresholds>('/api/copilot/insights/thresholds');
  return data;
}

export async function updateCopilotInsightThresholds(
  body: UpdateCopilotInsightThresholdsRequest,
): Promise<CopilotInsightThresholds> {
  const { data } = await http.put<CopilotInsightThresholds>('/api/copilot/insights/thresholds', body);
  return data;
}

export async function getShopperFunnel(days = 30): Promise<ShopperFunnelResponse> {
  const { data } = await http.get<ShopperFunnelResponse>('/api/copilot/shopper-funnel', { params: { days } });
  return data;
}

export async function getShopperDemandGaps(days = 90): Promise<ShopperDemandGap[]> {
  const { data } = await http.get<ShopperDemandGap[]>('/api/copilot/shopper-demand-gaps', {
    params: { days, limit: 10 },
  });
  return data;
}

export interface WatchSettingsView {
  enabled: boolean;
  intervalMinutes: number;
  notifyKind: 'webhook' | 'email' | 'none';
  notifyUrl?: string;
  notifySmtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
    to: string;
  };
  notifyOnlyOnNew: boolean;
  notifySubjectTemplate: string;
}

export async function getWatchSettings(): Promise<WatchSettingsView> {
  const { data } = await http.get<WatchSettingsView>('/api/copilot/watch');
  return data;
}

export async function updateWatchSettings(body: Partial<WatchSettingsView>): Promise<WatchSettingsView> {
  const { data } = await http.put<WatchSettingsView>('/api/copilot/watch', body);
  return data;
}

export async function runWatchNow(): Promise<{ ran: boolean; message: string }> {
  const { data } = await http.post<{ ran: boolean; message: string }>('/api/copilot/watch/run');
  return data;
}

export async function getShopperProductFunnel(days = 30): Promise<ShopperProductFunnelResponse> {
  const { data } = await http.get<ShopperProductFunnelResponse>('/api/copilot/shopper-product-funnel', {
    params: { days, limit: 20 },
  });
  return data;
}

export async function createDraftFromGap(
  keyword: string,
  categoryId?: string,
): Promise<{ conversationId: string; id: string; summary: string }> {
  const { data } = await http.post<{ conversationId: string; id: string; summary: string }>(
    '/api/copilot/shopper-demand-gaps/draft',
    { keyword, categoryId },
  );
  return data;
}

export async function auditActiveProducts(limit = 200): Promise<Array<{ id: string; title: string; missing: string[] }>> {
  const { data } = await http.get<Array<{ id: string; title: string; missing: string[] }>>(
    '/api/products/audit/active',
    { params: { limit } },
  );
  return data;
}
