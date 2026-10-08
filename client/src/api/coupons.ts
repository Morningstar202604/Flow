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
  console.info('[coupons] list');
  const { data } = await http.get<CouponListResponse>(
    `/api/coupons?page=${page}&pageSize=${pageSize}`,
  );
  return data;
}

export async function createCoupon(body: CreateCouponRequest): Promise<Coupon> {
  console.info('[coupons] create');
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
  console.info('[coupons] update', id);
  const { data } = await http.patch<Coupon>(
    `/api/coupons/${id}`,
    body,
  );
  return data;
}

export async function validateCoupon(
  body: ValidateCouponRequest,
): Promise<ValidateCouponResponse> {
  console.info('[coupons] validate', body.code);
  const { data } = await http.post<ValidateCouponResponse>(
    '/api/coupons/validate',
    body,
  );
  return data;
}
