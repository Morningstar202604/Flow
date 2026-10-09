import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type {
  InquiryMessage,
  InquirySession,
} from '@shared/api.interface';

export async function getSellerSessionList(): Promise<InquirySession[]> {
  const { data } = await http.get<InquirySession[]>(
    '/api/inquiry/sessions',
  );
  return data;
}

export async function getSellerMessageList(
  sessionId: string,
): Promise<InquiryMessage[]> {
  const { data } = await http.get<InquiryMessage[]>(
    `/api/inquiry/sessions/${sessionId}/messages`,
  );
  return data;
}

export async function sendSellerMessage(
  sessionId: string,
  content: string,
): Promise<InquiryMessage> {
  const { data } = await http.post<InquiryMessage>(
    '/api/inquiry/messages',
    { sessionId, content, role: 'seller' },
  );
  return data;
}
