import {
  pgTable, uuid, varchar, text, integer,
  decimal, timestamp, boolean, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['buyer', 'seller', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull().default(''),
  role: userRoleEnum('role').notNull().default('buyer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameZh: varchar('name_zh', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 100 }),
  titleZh: varchar('title_zh', { length: 500 }).notNull(),
  titleEn: varchar('title_en', { length: 500 }).notNull(),
  descZh: text('desc_zh').notNull().default(''),
  descEn: text('desc_en').notNull().default(''),
  longDescZh: text('long_desc_zh').notNull().default(''),
  longDescEn: text('long_desc_en').notNull().default(''),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  price: decimal('price', { precision: 12, scale: 2 }).notNull().default('0'),
  originalPrice: decimal('original_price', { precision: 12, scale: 2 }),
  stock: integer('stock').notNull().default(0),
  sold: integer('sold').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  coverImage: text('cover_image').notNull().default(''),
  images: text('images').array().notNull().default(sql`ARRAY[]::text[]`),
  seoKeywordsZh: varchar('seo_keywords_zh', { length: 500 }).notNull().default(''),
  seoKeywordsEn: varchar('seo_keywords_en', { length: 500 }).notNull().default(''),
  bulletPointsZh: text('bullet_points_zh').array().notNull().default(sql`ARRAY[]::text[]`),
  bulletPointsEn: text('bullet_points_en').array().notNull().default(sql`ARRAY[]::text[]`),
  weight: decimal('weight', { precision: 8, scale: 3 }),
  specs: text('specs').notNull().default('{}'),
  viewCount: integer('view_count').notNull().default(0),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionId: varchar('session_id', { length: 64 }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNo: varchar('order_no', { length: 32 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sellerId: uuid('seller_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).notNull().default('pending_payment'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  originalAmount: decimal('original_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  shippingAddress: text('shipping_address'),
  buyerName: varchar('buyer_name', { length: 100 }),
  shippingCity: varchar('shipping_city', { length: 100 }),
  shippingZip: varchar('shipping_zip', { length: 20 }),
  shippingCountry: varchar('shipping_country', { length: 100 }),
  buyerEmail: varchar('buyer_email', { length: 255 }),
  buyerPhone: varchar('buyer_phone', { length: 30 }),
  sessionId: varchar('session_id', { length: 64 }),
  remark: text('remark'),
  paymentMethod: varchar('payment_method', { length: 30 }),
  paymentId: varchar('payment_id', { length: 255 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  shippingCarrier: varchar('shipping_carrier', { length: 100 }),
  trackingNo: varchar('tracking_no', { length: 100 }),
  couponId: uuid('coupon_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productName: varchar('product_name', { length: 500 }).notNull(),
  productTitle: varchar('product_title', { length: 500 }),
  productSku: varchar('product_sku', { length: 100 }),
  productImage: text('product_image'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }),
  quantity: integer('quantity').notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 10 }).notNull().default('percent'),
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal('min_order_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalQuantity: integer('total_quantity').notNull().default(0),
  usedCount: integer('used_count').notNull().default(0),
  perUserLimit: integer('per_user_limit').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  role: varchar('role', { length: 16 }),
  action: varchar('action', { length: 50 }).notNull(),
  entity: varchar('entity', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 64 }),
  before: text('before'),
  after: text('after'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inquiryMessages = pgTable('inquiry_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsageLog = pgTable('ai_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  agent: varchar('agent', { length: 32 }).notNull(),
  model: varchar('model', { length: 64 }),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

export const categoryRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const orderRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// ---- supplementary tables referenced by services ----

export const cartRecoveryCodes = pgTable('cart_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  cartData: text('cart_data'),
  used: boolean('used').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inquirySessions = pgTable('inquiry_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
  userId: uuid('user_id'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const logistics = pgTable('logistics', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  carrier: varchar('carrier', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  trackingData: text('tracking_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  method: varchar('method', { length: 30 }).notNull(),
  provider: varchar('provider', { length: 30 }),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  transactionId: varchar('transaction_id', { length: 255 }),
  rawResponse: text('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
