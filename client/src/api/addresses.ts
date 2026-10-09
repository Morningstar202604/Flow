import { http } from '../lib/http';
import type {
  Address,
  CreateAddressRequest,
  UpdateAddressRequest,
  AddressListResponse,
} from '@shared/api.interface';

export async function getAddresses(): Promise<Address[]> {
  const { data } = await http.get<AddressListResponse>('/api/addresses');
  return data.items;
}

export async function getAddressDetail(id: string): Promise<Address> {
  const { data } = await http.get<Address>(`/api/addresses/${id}`);
  return data;
}

export async function createAddress(payload: CreateAddressRequest): Promise<Address> {
  const { data } = await http.post<Address>('/api/addresses', payload);
  return data;
}

export async function updateAddress(id: string, payload: UpdateAddressRequest): Promise<Address> {
  const { data } = await http.put<Address>(`/api/addresses/${id}`, payload);
  return data;
}

export async function deleteAddress(id: string): Promise<void> {
  await http.delete(`/api/addresses/${id}`);
}

export async function setDefaultAddress(id: string): Promise<Address> {
  const { data } = await http.put<Address>(`/api/addresses/${id}/default`);
  return data;
}
