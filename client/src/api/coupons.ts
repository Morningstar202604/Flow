import { http } from '../lib/http';
import type {
  Coupon,
  CouponListResponse,
  CreateCouponRequest,
  UpdateCouponRequest,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '@shared/api.interface';

export async function listCoupons(
  page = 1,
  pageSize = 20,
): Promise<CouponListResponse> {
  const { data } = await http.get<CouponListResponse>(
    `/api/coupons?page=${page}&pageSize=${pageSize}`,
  );
  return data;
}

export async function createCoupon(body: CreateCouponRequest): Promise<Coupon> {
  const { data } = await http.post<Coupon>(
    '/api/coupons',
    body,
  );
  return data;
}

export async function updateCoupon(
  id: string,
  body: UpdateCouponRequest,
): Promise<Coupon> {
  const { data } = await http.patch<Coupon>(
    `/api/coupons/${id}`,
    body,
  );
  return data;
}

export async function validateCoupon(
  body: ValidateCouponRequest,
): Promise<ValidateCouponResponse> {
  const { data } = await http.post<ValidateCouponResponse>(
    '/api/coupons/validate',
    body,
  );
  return data;
}
