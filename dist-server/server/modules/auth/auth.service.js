"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("../../database/database.provider");
const drizzle_orm_1 = require("drizzle-orm");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const schema_1 = require("@server/database/schema");
let AuthService = AuthService_1 = class AuthService {
    db;
    jwtService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(db, jwtService) {
        this.db = db;
        this.jwtService = jwtService;
    }
    async register(dto) {
        const email = dto.email?.trim().toLowerCase() ?? '';
        const name = dto.name?.trim() ?? '';
        if (!email || !dto.password || !name) {
            throw new common_1.BadRequestException('邮箱、密码、姓名不能为空');
        }
        const existing = await this.db
            .select({ id: schema_1.users.id })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (existing.length > 0) {
            throw new common_1.ConflictException('该邮箱已注册');
        }
        if (dto.password.length < 8) {
            throw new common_1.BadRequestException('密码长度至少 8 位');
        }
        if (!/[A-Za-z]/.test(dto.password) || !/[0-9]/.test(dto.password)) {
            throw new common_1.BadRequestException('密码必须同时包含字母和数字');
        }
        const role = dto.role === 'seller' ? 'seller' : 'buyer';
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const inserted = await this.db
            .insert(schema_1.users)
            .values({
            email,
            passwordHash,
            name,
            role,
        })
            .returning({
            id: schema_1.users.id,
            email: schema_1.users.email,
            name: schema_1.users.name,
            role: schema_1.users.role,
            createdAt: schema_1.users.createdAt,
        });
        const user = this.mapUser(inserted[0]);
        const token = this.generateToken(user);
        return { token, user };
    }
    async login(dto) {
        const email = dto.email?.trim().toLowerCase() ?? '';
        if (!email || !dto.password) {
            throw new common_1.BadRequestException('邮箱和密码不能为空');
        }
        const rows = await this.db
            .select({
            id: schema_1.users.id,
            email: schema_1.users.email,
            name: schema_1.users.name,
            role: schema_1.users.role,
            passwordHash: schema_1.users.passwordHash,
            createdAt: schema_1.users.createdAt,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (rows.length === 0) {
            throw new common_1.UnauthorizedException('邮箱或密码错误');
        }
        const row = rows[0];
        const valid = await bcrypt.compare(dto.password, row.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('邮箱或密码错误');
        }
        const user = this.mapUser(row);
        const token = this.generateToken(user);
        return { token, user };
    }
    async mergeGuestCart(userId, sessionId) {
        if (!sessionId)
            return;
        await this.db.transaction(async (tx) => {
            const guestItems = await tx
                .select({ productId: schema_1.cartItems.productId, quantity: schema_1.cartItems.quantity })
                .from(schema_1.cartItems)
                .where((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
            if (guestItems.length === 0)
                return;
            const values = guestItems.map((item) => ({
                userId,
                productId: item.productId,
                quantity: item.quantity,
                sessionId: '',
            }));
            await tx
                .insert(schema_1.cartItems)
                .values(values)
                .onConflictDoUpdate({
                target: [schema_1.cartItems.userId, schema_1.cartItems.productId],
                set: { quantity: (0, drizzle_orm_1.sql) `${schema_1.cartItems.quantity} + ${drizzle_orm_1.sql.raw('excluded.quantity')}` },
            });
            await tx.delete(schema_1.cartItems).where((0, drizzle_orm_1.eq)(schema_1.cartItems.sessionId, sessionId));
        });
    }
    async getUserById(id) {
        const rows = await this.db
            .select({
            id: schema_1.users.id,
            email: schema_1.users.email,
            name: schema_1.users.name,
            role: schema_1.users.role,
            createdAt: schema_1.users.createdAt,
        })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        if (rows.length === 0)
            return null;
        return this.mapUser(rows[0]);
    }
    mapUser(row) {
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            role: row.role,
            createdAt: row.createdAt.toISOString(),
        };
    }
    generateToken(user) {
        return this.jwtService.sign({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map