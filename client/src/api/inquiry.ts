import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type {
  InquiryMessage,
  InquirySession,
  SendMessageRequest,
} from '@shared/api.interface';

export async function createInquirySession(): Promise<InquirySession> {
  console.info('[inquiry] create session');
  const { data } = await http.post<InquirySession>(
    '/api/inquiry/sessions',
    { sessionId: getSessionId() },
  );
  return data;
}

export async function getInquiryMessages(
  sessionId: string,
): Promise<InquiryMessage[]> {
  console.info('[inquiry] messages', sessionId);
  const { data } = await http.get<InquiryMessage[]>(
    `/api/inquiry/sessions/${sessionId}/messages`,
  );
  return data;
}

export async function sendInquiryMessage(
  sessionId: string,
  content: string,
): Promise<InquiryMessage> {
  console.info('[inquiry] send', sessionId);
  const body: SendMessageRequest = { sessionId, content, role: 'user' };
  const { data } = await http.post<InquiryMessage>(
    `/api/inquiry/sessions/${sessionId}/messages`,
    body,
  );
  return data;
}

export async function getSellerSessionList(): Promise<InquirySession[]> {
  console.info('[inquiry] seller sessions');
  const { data } = await http.get<InquirySession[]>(
    '/api/inquiry/sessions',
  );
  return data;
}

export async function getSellerMessageList(
  sessionId: string,
): Promise<InquiryMessage[]> {
  console.info('[inquiry] seller messages', sessionId);
  const { data } = await http.get<InquiryMessage[]>(
    `/api/inquiry/sessions/${sessionId}/messages`,
  );
  return data;
}

export async function sendSellerMessage(
  sessionId: string,
  content: string,
): Promise<InquiryMessage> {
  console.info('[inquiry] seller send', sessionId);
  const { data } = await http.post<InquiryMessage>(
    '/api/inquiry/messages',
    { sessionId, content, role: 'seller' },
  );
  return data;
}
