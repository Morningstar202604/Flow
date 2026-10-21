import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type {
  CopilotActionResolveResult,
  CopilotConversation,
  CopilotConversationDetail,
  CopilotSendResult,
  CopilotToolsView,
} from '@shared/api.interface';

function buyerHeaders(): Record<string, string> {
  return { 'x-session-id': getSessionId() };
}

export async function getShopperTools(): Promise<CopilotToolsView> {
  const { data } = await http.get<CopilotToolsView>('/api/shopper/tools');
  return data;
}

export async function listShopperConversations(): Promise<CopilotConversation[]> {
  const { data } = await http.get<CopilotConversation[]>('/api/shopper/conversations', {
    headers: buyerHeaders(),
  });
  return data;
}

export async function createShopperConversation(): Promise<CopilotConversation> {
  const { data } = await http.post<CopilotConversation>(
    '/api/shopper/conversations',
    {},
    { headers: buyerHeaders() },
  );
  return data;
}

export async function getShopperConversation(id: string): Promise<CopilotConversationDetail> {
  const { data } = await http.get<CopilotConversationDetail>(`/api/shopper/conversations/${id}`, {
    headers: buyerHeaders(),
  });
  return data;
}

export async function sendShopperMessage(id: string, content: string): Promise<CopilotSendResult> {
  const { data } = await http.post<CopilotSendResult>(
    `/api/shopper/conversations/${id}/messages`,
    { content },
    { headers: buyerHeaders(), timeout: 60000 },
  );
  return data;
}

export async function resolveShopperAction(
  id: string,
  approve: boolean,
): Promise<CopilotActionResolveResult> {
  const { data } = await http.post<CopilotActionResolveResult>(
    `/api/shopper/actions/${id}/resolve`,
    { approve },
    { headers: buyerHeaders() },
  );
  return data;
}
