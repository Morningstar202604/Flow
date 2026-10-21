export type Language = 'zh' | 'en' | 'es' | 'pt';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** 会员积分（支付成功累计，退款按金额回滚） */
  points?: number;
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
  /** 注册卖家时需携带的邀请码（与 SELLER_REGISTRATION_CODE 环境变量一致） */
  sellerCode?: string;
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

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  optionValues: string[];
  price: string;
  originalPrice?: string;
  stock: number;
  sold: number;
  image?: string;
  status: string;
}

export interface Product {
  id: string;
  sellerId: string;
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
  coverImage?: string;
  images: string[];
  bulletPointsZh: string[];
  bulletPointsEn: string[];
  bulletPointsEs?: string[];
  bulletPointsPt?: string[];
  optionNames: string[];
  variants: ProductVariant[];
  minPrice?: string;
  maxPrice?: string;
  totalStock: number;
  totalSold: number;
  status: 'draft' | 'active' | 'inactive';
  weight?: string;
  avgRating?: number;
  reviewCount?: number;
  seoKeywordsZh: string;
  seoKeywordsEn: string;
  seoKeywordsEs?: string;
  seoKeywordsPt?: string;
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
  variantId?: string;
  variantInfo?: string;
  variantImage?: string;
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
  variantId?: string;
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
  variantId?: string;
  productTitle: string;
  variantInfo?: string;
  productSku?: string;
  productImage?: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface OrderFulfillment {
  carrier?: string;
  trackingNumber?: string;
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
  subtotal?: string;
  shippingFee?: string;
  discountAmount?: string;
  taxAmount?: string;
  totalAmount: string;
  status: OrderStatus;
  paymentMethod: string;
  couponId?: string;
  couponCode?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  customerNote?: string;
  items: OrderItem[];
  fulfillments: OrderFulfillment[];
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
  customerNote?: string;
  remark?: string; // @deprecated use customerNote
  couponCode?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
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
  trackingNumber?: string;
  carrier?: string;
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

// ==================== AI 模型设置与自定义 Agent ====================

export type AiConfigSource = 'db' | 'env' | 'none';

export interface AiSettingsView {
  configured: boolean;
  source: AiConfigSource;
  baseUrl: string;
  model: string;
  /** UI 中保存的 Key 掩码（环境变量来源的 Key 不回显） */
  apiKeyMasked: string | null;
}

export interface AiSettingsTestResult {
  ok: boolean;
  model?: string;
  message: string;
}

export interface BuiltinAgentMeta {
  key: string;
  name: string;
  description: string;
  usesModel: string;
}

export interface CustomAgent {
  id: string;
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  responseFormat: 'text' | 'json';
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentListResult {
  builtin: BuiltinAgentMeta[];
  custom: CustomAgent[];
}

export interface RunAgentResult {
  content: string;
  parsed?: unknown;
}

export interface UpdateAiSettingsRequest {
  /** 传空字符串清除 UI 中保存的值（回退环境变量/未配置） */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface CreateAgentRequest {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  responseFormat?: 'text' | 'json';
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
}

export type UpdateAgentRequest = Partial<Omit<CreateAgentRequest, 'slug'>>;

/** AI 报告历史（落库回看） */
export interface AIReportSummary {
  id: string;
  reportType: string;
  title: string;
  model?: string;
  createdAt: string;
}

export interface AIReportDetail extends AIReportSummary {
  content: string;
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
  /** 配置来源：db=UI 设置，env=环境变量，none=未配置 */
  source?: 'db' | 'env' | 'none';
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

// ==================== AI 运营副驾（工具调用 Agent + 人工审批） ====================

export type CopilotToolKind = 'read' | 'write';

export type CopilotActionStatus = 'pending' | 'executed' | 'rejected' | 'failed';

export interface CopilotMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** 工具消息：工具名与参数（便于卖家核对 Agent 读了什么、做了什么） */
  toolName?: string;
  toolArgs?: string;
  toolOk?: boolean;
  /** 助手消息关联的待审批动作 */
  actionId?: string;
  createdAt: string;
}

export interface CopilotAction {
  id: string;
  conversationId: string;
  toolName: string;
  kind: CopilotToolKind;
  summary: string;
  args: Record<string, unknown>;
  status: CopilotActionStatus;
  /** 同一轮生成的多步动作共享批次号；有值时可整批批准/拒绝 */
  batchId?: string;
  result?: string;
  errorMessage?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CopilotBatchResolveResult {
  actions: CopilotAction[];
  ok: boolean;
  message: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pendingActionCount?: number;
}

export interface CopilotConversationDetail {
  conversation: CopilotConversation;
  messages: CopilotMessage[];
  actions: CopilotAction[];
}

export interface CopilotSendResult {
  conversationId: string;
  reply: string;
  messages: CopilotMessage[];
  actions: CopilotAction[];
  /** 本轮命中的工具（按执行顺序） */
  toolTrace: Array<{ tool: string; kind: CopilotToolKind; ok: boolean }>;
}

export interface CopilotActionResolveResult {
  action: CopilotAction;
  ok: boolean;
  message: string;
}

export interface CopilotToolsView {
  tools: Array<{
    name: string;
    description: string;
    kind: CopilotToolKind;
    params: Array<{ name: string; type: string; required: boolean; description: string }>;
  }>;
}

// ==================== AI 运营副驾 · 店铺巡检 ====================

export type CopilotInsightType =
  | 'low_stock'
  | 'stale_refund'
  | 'unpaid_order'
  | 'stale_shipment';

export interface CopilotInsight {
  id: string;
  type: CopilotInsightType;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  suggestion: string;
  /** 可一键发给副驾的指令 */
  prompt: string;
  entityId?: string;
}

export interface CopilotInsightsView {
  generatedAt: string;
  thresholds: Record<string, number>;
  insights: CopilotInsight[];
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

export type CouponType = 'percent' | 'fixed' | 'free_shipping';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  appliesTo?: string;
  appliesToIds?: string[];
  freeShipping?: boolean;
  perUserLimit?: number;
  totalQuantity: number;
  usedCount: number;
  startsAt?: string;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

export interface CreateCouponRequest {
  code: string;
  type: CouponType;
  value?: number;
  minOrderAmount?: number;
  appliesTo?: 'all' | 'category' | 'product';
  appliesToIds?: string[];
  freeShipping?: boolean;
  perUserLimit?: number;
  totalQuantity?: number;
  startsAt?: string;
  expiresAt?: string;
  active?: boolean;
}

export interface UpdateCouponRequest {
  code?: string;
  type?: CouponType;
  value?: number;
  minOrderAmount?: number;
  appliesTo?: 'all' | 'category' | 'product';
  appliesToIds?: string[];
  freeShipping?: boolean;
  perUserLimit?: number;
  totalQuantity?: number;
  startsAt?: string;
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

// ========== Refund ==========

export interface Refund {
  id: string;
  orderId: string;
  userId: string;
  refundNo: string;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  amount: string;
  reason: string;
  reasonDetail?: string;
  items?: string;
  sellerReply?: string;
  refundMethod: string;
  approvedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundListParams {
  page?: number;
  pageSize?: number;
  status?: Refund['status'];
}

export interface RefundListResponse {
  items: Refund[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateRefundRequest {
  orderId: string;
  amount: number;
  reason: string;
  reasonDetail?: string;
  items?: string[];
  refundMethod?: string;
}

export interface RefundActionRequest {
  reply?: string;
}

// ========== Shipping Template ==========

export interface ShippingRule {
  countries: string[];
  firstWeight: string;
  firstWeightFee: string;
  additionalWeight: string;
  additionalWeightFee: string;
}

export interface ShippingTemplate {
  id: string;
  sellerId: string;
  name: string;
  rules: ShippingRule[];
  defaultRule?: ShippingRule;
  freeShippingThreshold?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateShippingTemplateRequest {
  name: string;
  rules: ShippingRule[];
  defaultRule?: ShippingRule;
  freeShippingThreshold?: number;
  status?: 'active' | 'inactive';
}

export interface UpdateShippingTemplateRequest {
  name?: string;
  rules?: ShippingRule[];
  defaultRule?: ShippingRule;
  freeShippingThreshold?: number;
  status?: 'active' | 'inactive';
}

export interface ShippingCalculateRequest {
  sellerId?: string;
  templateId?: string;
  country?: string;
  weightTotal?: number;
  qtyTotal?: number;
  subtotal?: number;
}

export interface ShippingCalculateResponse {
  fee: string;
  isFree: boolean;
  templateName?: string;
  currency: string;
}

// ========== Collection ==========

export interface Collection {
  id: string;
  sellerId: string;
  titleZh: string;
  titleEn: string;
  slug: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  isSmart?: boolean;
  smartRules?: string | null;
  productIds?: string[];
  productCount: number;
  sortOrder: number;
  isFeatured: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontSection {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  products: Product[];
}

export interface CreateCollectionRequest {
  titleZh: string;
  titleEn: string;
  slug?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  isSmart?: boolean;
  smartRules?: Array<{ field: string; operator: string; value: string | number }>;
  productIds?: string[];
  sortOrder?: number;
  isFeatured?: boolean;
  status?: 'active' | 'inactive';
}

export interface UpdateCollectionRequest {
  titleZh?: string;
  titleEn?: string;
  slug?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  coverImage?: string;
  isSmart?: boolean;
  smartRules?: Array<{ field: string; operator: string; value: string | number }>;
  productIds?: string[];
  sortOrder?: number;
  isFeatured?: boolean;
  status?: 'active' | 'inactive';
}

export interface CollectionProductRequest {
  productId: string;
}

export interface CollectionReorderRequest {
  productIds: string[];
}

export interface CollectionListResponse {
  items: Collection[];
  total: number;
  page: number;
  pageSize: number;
}

// ========== CMS Page ==========

export interface CmsPage {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
  isPublished: boolean;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmsPageRequest {
  slug: string;
  titleZh: string;
  titleEn: string;
  contentZh?: string;
  contentEn?: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
  isPublished?: boolean;
}

export interface UpdateCmsPageRequest {
  slug?: string;
  titleZh?: string;
  titleEn?: string;
  contentZh?: string;
  contentEn?: string;
  metaTitleZh?: string;
  metaTitleEn?: string;
  metaDescZh?: string;
  metaDescEn?: string;
  isPublished?: boolean;
}

export interface CmsPageListParams {
  page?: number;
  pageSize?: number;
  /** 'published' | 'draft'（映射到 is_published） */
  status?: 'published' | 'draft';
  keyword?: string;
}

export interface CmsPageListResponse {
  items: CmsPage[];
  total: number;
  page: number;
  pageSize: number;
}

// ========== Address ==========

export interface Address {
  id: string;
  userId: string;
  label?: string;
  receiverName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  zipCode?: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressRequest {
  label?: string;
  receiverName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  zipCode?: string;
  country: string;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  label?: string;
  receiverName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface AddressListResponse {
  items: Address[];
  total: number;
}
