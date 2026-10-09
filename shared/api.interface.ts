export type Language = 'zh' | 'en' | 'es' | 'pt';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: 'buyer' | 'seller';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthStatus {
  configured: boolean;
  clientId?: string;
}

export interface Category {
  id: string;
  nameZh: string;
  nameEn: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

export interface ProductSpec {
  [key: string]: string;
}

export interface Product {
  id: string;
  sku?: string;
  titleZh: string;
  titleEn: string;
  titleEs?: string;
  titlePt?: string;
  descZh: string;
  descEn: string;
  descEs?: string;
  descPt?: string;
  longDescZh: string;
  longDescEn: string;
  longDescEs?: string;
  longDescPt?: string;
  categoryId?: string;
  categoryNameZh?: string;
  categoryNameEn?: string;
  price: string;
  originalPrice?: string;
  stock: number;
  sold: number;
  status: 'draft' | 'active' | 'inactive';
  coverImage?: string;
  images: string[];
  specs: ProductSpec;
  seoKeywordsZh: string;
  seoKeywordsEn: string;
  seoKeywordsEs?: string;
  seoKeywordsPt?: string;
  bulletPointsZh: string[];
  bulletPointsEn: string[];
  bulletPointsEs?: string[];
  bulletPointsPt?: string[];
  weight?: string;
  avgRating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListParams {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'sold_desc' | 'newest';
  status?: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateProductRequest {
  sku?: string;
  titleZh: string;
  titleEn: string;
  descZh?: string;
  descEn?: string;
  longDescZh?: string;
  longDescEn?: string;
  categoryId?: string;
  price: number;
  originalPrice?: number;
  stock?: number;
  status?: 'draft' | 'active' | 'inactive';
  coverImage?: string;
  images?: string[];
  specs?: ProductSpec;
  seoKeywordsZh?: string;
  seoKeywordsEn?: string;
  bulletPointsZh?: string[];
  bulletPointsEn?: string[];
  weight?: number;
}

export interface ImportFailure {
  row: number;
  reason: string;
}

export interface ImportProductsResponse {
  successCount: number;
  failCount: number;
  failures: ImportFailure[];
}

export interface UpdateProductRequest {
  sku?: string;
  titleZh?: string;
  titleEn?: string;
  descZh?: string;
  descEn?: string;
  longDescZh?: string;
  longDescEn?: string;
  categoryId?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  status?: 'draft' | 'active' | 'inactive';
  coverImage?: string;
  images?: string[];
  specs?: ProductSpec;
  seoKeywordsZh?: string;
  seoKeywordsEn?: string;
  bulletPointsZh?: string[];
  bulletPointsEn?: string[];
  weight?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: string;
  total: string;
  itemCount: number;
}

export interface AddCartRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartRequest {
  quantity: number;
}

export interface CartRecoveryCodeResponse {
  code: string;
}

export interface CartImportCodeRequest {
  code: string;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  productId?: string;
  productTitle: string;
  productImage?: string;
  price: string;
  quantity: number;
  subtotal: string;
}

export interface Order {
  id: string;
  orderNo: string;
  userId?: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip?: string;
  shippingCountry: string;
  totalAmount: string;
  status: OrderStatus;
  paymentMethod: string;
  couponId?: string;
  discountAmount?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNo?: string;
  remark?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip?: string;
  shippingCountry: string;
  paymentMethod: PaymentProvider;
  remark?: string;
  couponCode?: string;
  items: { productId: string; quantity: number }[];
}

export interface OrderListParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  keyword?: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderStatusUpdateRequest {
  status: OrderStatus;
  trackingNo?: string;
}

export interface InquiryMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'seller';
  content: string;
  createdAt: string;
}

export interface InquirySession {
  id: string;
  sessionId: string;
  userId?: string;
  status: 'active' | 'closed';
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  role: 'user' | 'seller';
}

export interface DashboardStats {
  gmv: string;
  orderCount: number;
  visitorCount: number;
  productCount: number;
  todayGmv: string;
  todayOrders: number;
  pendingOrders: number;
}

export interface SalesTrendItem {
  date: string;
  amount: number;
  orders: number;
}

export interface CategorySalesItem {
  name: string;
  amount: number;
  percentage: number;
}

export interface DashboardData {
  stats: DashboardStats;
  salesTrend: SalesTrendItem[];
  categorySales: CategorySalesItem[];
}

export interface AICopywriterRequest {
  productNameZh?: string;
  specs?: string;
  category?: string;
  targetMarket?: string;
}

export interface AICopywriterResponse {
  titleEn: string;
  bulletPoints: string[];
  longDescription: string;
  seoKeywords: string;
}

export interface AITranslationRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
}

export interface AITranslationResponse {
  translatedText: string;
}

export interface AITrendReport {
  id: string;
  reportType: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface AISelectItem {
  keyword: string;
  estimatedDemand: string;
  suggestedPriceRange: string;
  reason: string;
  confidence: number;
}

export interface AISelectResponse {
  items: AISelectItem[];
}

export interface AIStatusResponse {
  configured: boolean;
  model?: string;
}

export interface AIUsageAgentStat {
  agent: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface AIUsageStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  successRate: number;
  byAgent: AIUsageAgentStat[];
}

export interface AIUsageStatsQuery {
  agent?: string;
  startDate?: string;
  endDate?: string;
}

export type PaymentProvider = 'stripe' | 'paypal' | 'demo';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  amount: string;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  createdAt: string;
}

export interface PayRequest {
  orderId: string;
  provider: PaymentProvider;
}

export interface PayResponse {
  success: boolean;
  payment?: Payment;
  order?: Order;
  message?: string;
  demoMode?: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface ProductReviewsResponse {
  items: ProductReview[];
  averageRating: number;
  totalCount: number;
}

export interface CreateReviewRequest {
  rating: number;
  comment?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export interface FavoriteProduct {
  id: string;
  productId: string;
  product: Product;
  createdAt: string;
}

export type CouponType = 'percent' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  totalQuantity: number;
  usedCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

export interface CreateCouponRequest {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  totalQuantity?: number;
  expiresAt?: string;
  active?: boolean;
}

export interface UpdateCouponRequest {
  code?: string;
  type?: CouponType;
  value?: number;
  minOrderAmount?: number;
  totalQuantity?: number;
  expiresAt?: string;
  active?: boolean;
}

export interface CouponListParams {
  page?: number;
  pageSize?: number;
}

export interface CouponListResponse {
  items: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ValidateCouponRequest {
  code: string;
  orderAmount: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  finalAmount: number;
  message?: string;
}

export interface SupportChatRequest {
  sessionId: string;
  message: string;
  language?: Language;
  orderNo?: string;
}

export interface SupportChatResponse {
  reply: string;
  sources?: string[];
}

export type LogisticsStatus =
  | 'ordered'
  | 'paid'
  | 'shipped'
  | 'in_transit'
  | 'delivered';

export interface LogisticsEvent {
  status: LogisticsStatus;
  description: string;
  location?: string;
  time: string;
}

export interface LogisticsTracking {
  orderId: string;
  carrier?: string;
  trackingNumber?: string;
  events: LogisticsEvent[];
  isDemo: boolean;
}

export interface CreateLogisticsRequest {
  orderId: string;
  carrier: string;
  trackingNumber: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  role?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
}
