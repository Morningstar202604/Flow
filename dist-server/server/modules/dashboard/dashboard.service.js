"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("@server/database/schema");
let DashboardService = DashboardService_1 = class DashboardService {
    db;
    logger = new common_1.Logger(DashboardService_1.name);
    constructor(db) {
        this.db = db;
    }
    async getStats() {
        const [statsResult, salesTrend, categorySales] = await Promise.all([
            this.getDashboardStats(),
            this.getSalesTrend(),
            this.getCategorySales(),
        ]);
        return {
            stats: statsResult,
            salesTrend,
            categorySales,
        };
    }
    async getDashboardStats() {
        const todayStart = this.getTodayStartIso();
        const windowStart = this.getDaysAgoStartIso(90);
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
      SELECT
        COALESCE(SUM(CASE WHEN o.status IN ('paid', 'shipped', 'delivered') THEN o.total_amount ELSE 0 END), 0)::text AS gmv,
        COALESCE(COUNT(o.id), 0)::text AS order_count,
        (SELECT COUNT(DISTINCT ${schema_1.inquirySessions.sessionId}) FROM ${schema_1.inquirySessions} WHERE ${schema_1.inquirySessions.createdAt} >= ${windowStart}::timestamptz)::text AS visitor_count,
        (SELECT COUNT(${schema_1.products.id}) FROM ${schema_1.products})::text AS product_count,
        COALESCE(SUM(CASE WHEN o.status IN ('paid', 'shipped', 'delivered') AND o._created_at >= ${todayStart}::timestamptz THEN o.total_amount ELSE 0 END), 0)::text AS today_gmv,
        COALESCE(COUNT(CASE WHEN o._created_at >= ${todayStart}::timestamptz THEN 1 END), 0)::text AS today_orders,
        COALESCE(COUNT(CASE WHEN o.status = 'paid' THEN 1 END), 0)::text AS pending_orders
      FROM orders o
      WHERE o._created_at >= ${windowStart}::timestamptz
    `);
        const row = result[0];
        if (!row) {
            return {
                gmv: '0',
                orderCount: 0,
                visitorCount: 0,
                productCount: 0,
                todayGmv: '0',
                todayOrders: 0,
                pendingOrders: 0,
            };
        }
        return {
            gmv: row.gmv,
            orderCount: parseInt(row.order_count, 10),
            visitorCount: parseInt(row.visitor_count, 10),
            productCount: parseInt(row.product_count, 10),
            todayGmv: row.today_gmv,
            todayOrders: parseInt(row.today_orders, 10),
            pendingOrders: parseInt(row.pending_orders, 10),
        };
    }
    async getSalesTrend() {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(o.total_amount), 0)::text AS amount,
        COALESCE(COUNT(o.id), 0)::text AS orders
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS day
      ) d
       LEFT JOIN orders o
         ON DATE(o._created_at AT TIME ZONE 'Asia/Shanghai') = d.day
         AND o.status IN ('paid', 'shipped', 'delivered')
         AND o._created_at >= (CURRENT_DATE - INTERVAL '29 days')
       GROUP BY d.day
      ORDER BY d.day ASC
    `);
        return result.map((row) => ({
            date: row.date,
            amount: parseFloat(row.amount),
            orders: parseInt(row.orders, 10),
        }));
    }
    async getCategorySales() {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
      SELECT
        COALESCE(c.name_zh, '未分类') AS name,
        SUM(oi.subtotal)::text AS amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status IN ('paid', 'shipped', 'delivered')
        AND o._created_at >= (CURRENT_DATE - INTERVAL '89 days')
      GROUP BY c.name_zh
      ORDER BY SUM(oi.subtotal) DESC
    `);
        if (result.length === 0) {
            return [];
        }
        const totalAmount = result.reduce((sum, row) => sum + parseFloat(row.amount), 0);
        // 前5个保留，其余归为"其他"
        const top5 = result.slice(0, 5);
        const rest = result.slice(5);
        const items = top5.map((row) => ({
            name: row.name,
            amount: parseFloat(row.amount),
            percentage: totalAmount > 0
                ? Math.round((parseFloat(row.amount) / totalAmount) * 1000) / 10
                : 0,
        }));
        if (rest.length > 0) {
            const restAmount = rest.reduce((sum, row) => sum + parseFloat(row.amount), 0);
            items.push({
                name: '其他',
                amount: restAmount,
                percentage: totalAmount > 0
                    ? Math.round((restAmount / totalAmount) * 1000) / 10
                    : 0,
            });
        }
        return items;
    }
    getDaysAgoStartIso(days) {
        const now = new Date();
        const shanghaiOffset = 8 * 60;
        const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
        const shanghaiMinutes = utcMinutes + shanghaiOffset;
        const dayStartShanghaiMinutes = Math.floor(shanghaiMinutes / 1440) * 1440 - shanghaiOffset - days * 1440;
        return new Date(dayStartShanghaiMinutes * 60000).toISOString();
    }
    getTodayStartIso() {
        const now = new Date();
        // 按 Asia/Shanghai 时区计算今日零点
        const shanghaiOffset = 8 * 60; // UTC+8
        const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
        const shanghaiMinutes = utcMinutes + shanghaiOffset;
        const todayStartShanghaiMinutes = Math.floor(shanghaiMinutes / 1440) * 1440 - shanghaiOffset;
        const todayStart = new Date(todayStartShanghaiMinutes * 60000);
        return todayStart.toISOString();
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map