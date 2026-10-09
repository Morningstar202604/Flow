import { http } from '../lib/http';
import { getSessionId } from '@/utils/session';
import type {
  CartResponse,
  AddCartRequest,
  UpdateCartRequest,
  CartRecoveryCodeResponse,
  CartImportCodeRequest,
} from '@shared/api.interface';

function cartHeaders(): Record<string, string> {
  return { 'x-session-id': getSessionId() };
}

export async function getCart(): Promise<CartResponse> {
  const { data } = await http.get<CartResponse>('/api/cart', {
    headers: cartHeaders(),
  });
  return data;
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<CartResponse> {
  const body: AddCartRequest = { productId, quantity };
  const { data } = await http.post<CartResponse>(
    '/api/cart/items',
    body,
    { headers: cartHeaders() },
  );
  return data;
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
): Promise<CartResponse> {
  const body: UpdateCartRequest = { quantity };
  const { data } = await http.patch<CartResponse>(
    `/api/cart/items/${itemId}`,
    body,
    { headers: cartHeaders() },
  );
  return data;
}

export async function removeCartItem(itemId: string): Promise<CartResponse> {
  const { data } = await http.delete<CartResponse>(
    `/api/cart/items/${itemId}`,
    { headers: cartHeaders() },
  );
  return data;
}

export async function exportRecoveryCode(): Promise<{ code: string }> {
  const { data } = await http.get<CartRecoveryCodeResponse>(
    '/api/cart/export-code',
    { headers: cartHeaders() },
  );
  return data;
}

export async function importRecoveryCode(
  code: string,
): Promise<CartResponse> {
  const body: CartImportCodeRequest = { code };
  const { data } = await http.post<CartResponse>(
    '/api/cart/import-code',
    body,
    { headers: cartHeaders() },
  );
  return data;
}
