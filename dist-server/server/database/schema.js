"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payments = exports.logistics = exports.inquirySessions = exports.cartRecoveryCodes = exports.orderItemRelations = exports.orderRelations = exports.categoryRelations = exports.productRelations = exports.aiUsageLog = exports.inquiryMessages = exports.inquiries = exports.auditLogs = exports.favorites = exports.reviews = exports.coupons = exports.orderItems = exports.orders = exports.cartItems = exports.productEmbeddings = exports.products = exports.categories = exports.users = exports.userRoleEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.userRoleEnum = (0, pg_core_1.pgEnum)('user_role', ['buyer', 'seller', 'admin']);
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull().default(''),
    role: (0, exports.userRoleEnum)('role').notNull().default('buyer'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    nameZh: (0, pg_core_1.varchar)('name_zh', { length: 100 }).notNull(),
    nameEn: (0, pg_core_1.varchar)('name_en', { length: 100 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).notNull().unique(),
    icon: (0, pg_core_1.varchar)('icon', { length: 50 }),
    sortOrder: (0, pg_core_1.integer)('sort_order').notNull().default(0),
    updatedBy: (0, pg_core_1.uuid)('updated_by'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    sku: (0, pg_core_1.varchar)('sku', { length: 100 }),
    titleZh: (0, pg_core_1.varchar)('title_zh', { length: 500 }).notNull(),
    titleEn: (0, pg_core_1.varchar)('title_en', { length: 500 }).notNull(),
    descZh: (0, pg_core_1.text)('desc_zh').notNull().default(''),
    descEn: (0, pg_core_1.text)('desc_en').notNull().default(''),
    longDescZh: (0, pg_core_1.text)('long_desc_zh').notNull().default(''),
    longDescEn: (0, pg_core_1.text)('long_desc_en').notNull().default(''),
    categoryId: (0, pg_core_1.uuid)('category_id').references(() => exports.categories.id, { onDelete: 'set null' }),
    price: (0, pg_core_1.decimal)('price', { precision: 12, scale: 2 }).notNull().default('0'),
    originalPrice: (0, pg_core_1.decimal)('original_price', { precision: 12, scale: 2 }),
    stock: (0, pg_core_1.integer)('stock').notNull().default(0),
    sold: (0, pg_core_1.integer)('sold').notNull().default(0),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('draft'),
    coverImage: (0, pg_core_1.text)('cover_image').notNull().default(''),
    images: (0, pg_core_1.text)('images').array().notNull().default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    seoKeywordsZh: (0, pg_core_1.varchar)('seo_keywords_zh', { length: 500 }).notNull().default(''),
    seoKeywordsEn: (0, pg_core_1.varchar)('seo_keywords_en', { length: 500 }).notNull().default(''),
    bulletPointsZh: (0, pg_core_1.text)('bullet_points_zh').array().notNull().default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    bulletPointsEn: (0, pg_core_1.text)('bullet_points_en').array().notNull().default((0, drizzle_orm_1.sql) `ARRAY[]::text[]`),
    weight: (0, pg_core_1.decimal)('weight', { precision: 8, scale: 3 }),
    specs: (0, pg_core_1.text)('specs').notNull().default('{}'),
    viewCount: (0, pg_core_1.integer)('view_count').notNull().default(0),
    updatedBy: (0, pg_core_1.uuid)('updated_by'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.productEmbeddings = (0, pg_core_1.pgTable)('product_embeddings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'cascade' }),
    contentHash: (0, pg_core_1.varchar)('content_hash', { length: 64 }).notNull(),
    embedding: (0, pg_core_1.text)('embedding').notNull(),
    textContent: (0, pg_core_1.text)('text_content').notNull(),
    model: (0, pg_core_1.varchar)('model', { length: 64 }).notNull().default('local-hash-embedding'),
    dimension: (0, pg_core_1.integer)('dimension').notNull().default(384),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.cartItems = (0, pg_core_1.pgTable)('cart_items', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 64 }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'cascade' }),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderNo: (0, pg_core_1.varchar)('order_no', { length: 32 }).notNull().unique(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    sellerId: (0, pg_core_1.uuid)('seller_id').references(() => exports.users.id, { onDelete: 'set null' }),
    status: (0, pg_core_1.varchar)('status', { length: 30 }).notNull().default('pending_payment'),
    totalAmount: (0, pg_core_1.decimal)('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    originalAmount: (0, pg_core_1.decimal)('original_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountAmount: (0, pg_core_1.decimal)('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    shippingAddress: (0, pg_core_1.text)('shipping_address'),
    buyerName: (0, pg_core_1.varchar)('buyer_name', { length: 100 }),
    shippingCity: (0, pg_core_1.varchar)('shipping_city', { length: 100 }),
    shippingZip: (0, pg_core_1.varchar)('shipping_zip', { length: 20 }),
    shippingCountry: (0, pg_core_1.varchar)('shipping_country', { length: 100 }),
    buyerEmail: (0, pg_core_1.varchar)('buyer_email', { length: 255 }),
    buyerPhone: (0, pg_core_1.varchar)('buyer_phone', { length: 30 }),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 64 }),
    remark: (0, pg_core_1.text)('remark'),
    paymentMethod: (0, pg_core_1.varchar)('payment_method', { length: 30 }),
    paymentId: (0, pg_core_1.varchar)('payment_id', { length: 255 }),
    paidAt: (0, pg_core_1.timestamp)('paid_at', { withTimezone: true }),
    shippedAt: (0, pg_core_1.timestamp)('shipped_at', { withTimezone: true }),
    deliveredAt: (0, pg_core_1.timestamp)('delivered_at', { withTimezone: true }),
    cancelledAt: (0, pg_core_1.timestamp)('cancelled_at', { withTimezone: true }),
    trackingNumber: (0, pg_core_1.varchar)('tracking_number', { length: 100 }),
    shippingCarrier: (0, pg_core_1.varchar)('shipping_carrier', { length: 100 }),
    trackingNo: (0, pg_core_1.varchar)('tracking_no', { length: 100 }),
    couponId: (0, pg_core_1.uuid)('coupon_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.orderItems = (0, pg_core_1.pgTable)('order_items', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'restrict' }),
    productName: (0, pg_core_1.varchar)('product_name', { length: 500 }).notNull(),
    productTitle: (0, pg_core_1.varchar)('product_title', { length: 500 }),
    productSku: (0, pg_core_1.varchar)('product_sku', { length: 100 }),
    productImage: (0, pg_core_1.text)('product_image'),
    unitPrice: (0, pg_core_1.decimal)('unit_price', { precision: 12, scale: 2 }).notNull(),
    price: (0, pg_core_1.decimal)('price', { precision: 12, scale: 2 }),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    subtotal: (0, pg_core_1.decimal)('subtotal', { precision: 12, scale: 2 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.coupons = (0, pg_core_1.pgTable)('coupons', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    code: (0, pg_core_1.varchar)('code', { length: 50 }).notNull().unique(),
    type: (0, pg_core_1.varchar)('type', { length: 10 }).notNull().default('percent'),
    value: (0, pg_core_1.decimal)('value', { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: (0, pg_core_1.decimal)('min_order_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    totalQuantity: (0, pg_core_1.integer)('total_quantity').notNull().default(0),
    usedCount: (0, pg_core_1.integer)('used_count').notNull().default(0),
    perUserLimit: (0, pg_core_1.integer)('per_user_limit').notNull().default(1),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'),
    startsAt: (0, pg_core_1.timestamp)('starts_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    active: (0, pg_core_1.boolean)('active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.reviews = (0, pg_core_1.pgTable)('reviews', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'cascade' }),
    rating: (0, pg_core_1.integer)('rating').notNull(),
    content: (0, pg_core_1.text)('content').notNull().default(''),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.favorites = (0, pg_core_1.pgTable)('favorites', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.uuid)('product_id').notNull().references(() => exports.products.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id'),
    role: (0, pg_core_1.varchar)('role', { length: 16 }),
    action: (0, pg_core_1.varchar)('action', { length: 50 }).notNull(),
    entity: (0, pg_core_1.varchar)('entity', { length: 50 }).notNull(),
    entityId: (0, pg_core_1.varchar)('entity_id', { length: 64 }),
    before: (0, pg_core_1.text)('before'),
    after: (0, pg_core_1.text)('after'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.inquiries = (0, pg_core_1.pgTable)('inquiries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull(),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }),
    subject: (0, pg_core_1.varchar)('subject', { length: 200 }).notNull(),
    message: (0, pg_core_1.text)('message').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    reply: (0, pg_core_1.text)('reply'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    repliedAt: (0, pg_core_1.timestamp)('replied_at', { withTimezone: true }),
});
exports.inquiryMessages = (0, pg_core_1.pgTable)('inquiry_messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 64 }).notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 16 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.aiUsageLog = (0, pg_core_1.pgTable)('ai_usage_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    agent: (0, pg_core_1.varchar)('agent', { length: 32 }).notNull(),
    model: (0, pg_core_1.varchar)('model', { length: 64 }),
    inputTokens: (0, pg_core_1.integer)('input_tokens').notNull().default(0),
    outputTokens: (0, pg_core_1.integer)('output_tokens').notNull().default(0),
    durationMs: (0, pg_core_1.integer)('duration_ms').notNull().default(0),
    success: (0, pg_core_1.boolean)('success').notNull().default(true),
    errorMessage: (0, pg_core_1.text)('error_message'),
    userId: (0, pg_core_1.uuid)('user_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.productRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one, many }) => ({
    category: one(exports.categories, { fields: [exports.products.categoryId], references: [exports.categories.id] }),
    embeddings: many(exports.productEmbeddings),
}));
exports.categoryRelations = (0, drizzle_orm_1.relations)(exports.categories, ({ many }) => ({
    products: many(exports.products),
}));
exports.orderRelations = (0, drizzle_orm_1.relations)(exports.orders, ({ many }) => ({
    items: many(exports.orderItems),
}));
exports.orderItemRelations = (0, drizzle_orm_1.relations)(exports.orderItems, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.orderItems.orderId], references: [exports.orders.id] }),
}));
// ---- supplementary tables referenced by services ----
exports.cartRecoveryCodes = (0, pg_core_1.pgTable)('cart_recovery_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 64 }).notNull(),
    code: (0, pg_core_1.varchar)('code', { length: 32 }).notNull().unique(),
    cartData: (0, pg_core_1.text)('cart_data'),
    used: (0, pg_core_1.boolean)('used').notNull().default(false),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.inquirySessions = (0, pg_core_1.pgTable)('inquiry_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 64 }).notNull().unique(),
    userId: (0, pg_core_1.uuid)('user_id'),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.logistics = (0, pg_core_1.pgTable)('logistics', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id, { onDelete: 'cascade' }),
    carrier: (0, pg_core_1.varchar)('carrier', { length: 100 }),
    trackingNumber: (0, pg_core_1.varchar)('tracking_number', { length: 100 }),
    status: (0, pg_core_1.varchar)('status', { length: 30 }).notNull().default('pending'),
    trackingData: (0, pg_core_1.text)('tracking_data'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.payments = (0, pg_core_1.pgTable)('payments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)('order_id').notNull().references(() => exports.orders.id, { onDelete: 'cascade' }),
    method: (0, pg_core_1.varchar)('method', { length: 30 }).notNull(),
    provider: (0, pg_core_1.varchar)('provider', { length: 30 }),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    amount: (0, pg_core_1.decimal)('amount', { precision: 12, scale: 2 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 30 }).notNull().default('pending'),
    transactionId: (0, pg_core_1.varchar)('transaction_id', { length: 255 }),
    rawResponse: (0, pg_core_1.text)('raw_response'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=schema.js.map