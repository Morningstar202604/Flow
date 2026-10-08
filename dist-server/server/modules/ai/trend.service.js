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
var TrendService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_provider_1 = require("../../database/database.provider");
const ai_gateway_service_1 = require("./ai-gateway.service");
const schema_1 = require("@server/database/schema");
let TrendService = TrendService_1 = class TrendService {
    db;
    aiGateway;
    logger = new common_1.Logger(TrendService_1.name);
    constructor(db, aiGateway) {
        this.db = db;
        this.aiGateway = aiGateway;
    }
    async generateTrendReport(userId, appUserId) {
        const salesData = await this.getSalesData();
        const categorySales = await this.getCategorySales();
        const topProducts = await this.getTopProducts();
        const allCategories = await this.db.select({
            id: schema_1.categories.id,
            nameZh: schema_1.categories.nameZh,
            nameEn: schema_1.categories.nameEn,
        }).from(schema_1.categories);
        const dataContext = JSON.stringify({
            salesTrend: salesData,
            categorySales,
            topProducts,
            categories: allCategories,
        }, null, 2);
        const now = new Date();
        const seasonMonth = now.getMonth() + 1;
        const seasonYear = now.getFullYear();
        const systemPrompt = '你是专业的跨境电商市场分析师，擅长基于销售数据分析市场趋势并给出可执行的建议。请用中文输出 Markdown 格式的报告。';
        const userPrompt = `基于以下本店销售数据，生成一份深度市场趋势分析报告（Markdown 格式）。

## 销售数据
${dataContext}

## 报告要求
请包含以下章节（Markdown ## 二级标题）：
1. 热搜词分析 - 基于热销商品关键词提炼当前热门搜索词
2. 价格带分析 - 分析各价格区间的销售表现，找出黄金价格带
3. 季节性趋势建议 - 结合当前季节（${seasonYear}年${seasonMonth}月）给出选品和营销建议
4. 行动建议 - 给出3-5条具体可执行的运营行动建议

请直接输出完整的 Markdown 报告内容，不要包裹在代码块中。`;
        const { content } = await this.aiGateway.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { temperature: 0.7, maxTokens: 3000, agent: 'trend', userId: appUserId });
        return {
            id: `trend-${Date.now()}`,
            reportType: 'trend',
            title: '市场趋势分析报告',
            content,
            status: 'completed',
            createdAt: new Date().toISOString(),
        };
    }
    async getSalesData() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const rows = await this.db
            .select({
            date: (0, drizzle_orm_1.sql) `to_char(${schema_1.orders.createdAt}, 'YYYY-MM-DD')`,
            amount: (0, drizzle_orm_1.sum)(schema_1.orders.totalAmount).mapWith(Number),
            orders: (0, drizzle_orm_1.count)(schema_1.orders.id).mapWith(Number),
        })
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.orders.createdAt, thirtyDaysAgo), (0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered')))
            .groupBy((0, drizzle_orm_1.sql) `to_char(${schema_1.orders.createdAt}, 'YYYY-MM-DD')`)
            .orderBy((0, drizzle_orm_1.sql) `to_char(${schema_1.orders.createdAt}, 'YYYY-MM-DD')`);
        return rows.map((row) => ({
            date: row.date,
            amount: row.amount ?? 0,
            orders: row.orders ?? 0,
        }));
    }
    async getCategorySales() {
        const rows = await this.db
            .select({
            categoryName: schema_1.categories.nameEn,
            amount: (0, drizzle_orm_1.sum)(schema_1.orderItems.subtotal).mapWith(Number),
        })
            .from(schema_1.orderItems)
            .innerJoin(schema_1.products, (0, drizzle_orm_1.eq)(schema_1.orderItems.productId, schema_1.products.id))
            .innerJoin(schema_1.categories, (0, drizzle_orm_1.eq)(schema_1.products.categoryId, schema_1.categories.id))
            .innerJoin(schema_1.orders, (0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, schema_1.orders.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered'))
            .groupBy(schema_1.categories.nameEn)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sum)(schema_1.orderItems.subtotal)));
        return rows.map((row) => ({
            categoryName: row.categoryName,
            amount: row.amount ?? 0,
        }));
    }
    async getTopProducts() {
        const rows = await this.db
            .select({
            id: schema_1.products.id,
            titleEn: schema_1.products.titleEn,
            sold: schema_1.products.sold,
            price: schema_1.products.price,
        })
            .from(schema_1.products)
            .where((0, drizzle_orm_1.eq)(schema_1.products.status, 'active'))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.products.sold))
            .limit(10);
        return rows.map((row) => ({
            id: row.id,
            titleEn: row.titleEn,
            sold: row.sold,
            price: String(row.price),
        }));
    }
};
exports.TrendService = TrendService;
exports.TrendService = TrendService = TrendService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, ai_gateway_service_1.AiGatewayService])
], TrendService);
//# sourceMappingURL=trend.service.js.map