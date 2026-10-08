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
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const bcrypt = __importStar(require("bcrypt"));
const database_provider_1 = require("../../database/database.provider");
const auth_service_1 = require("./auth.service");
const roles_guard_1 = require("@server/common/guards/roles.guard");
const jwt_auth_middleware_1 = require("@server/common/middleware/jwt-auth.middleware");
const schema_1 = require("@server/database/schema");
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();
function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) {
        return xff.split(',')[0].trim();
    }
    const ip = req.socket?.remoteAddress;
    return ip || 'unknown';
}
function checkRateLimit(ip, key) {
    const now = Date.now();
    const mapKey = `${ip}:${key}`;
    const entry = rateLimitMap.get(mapKey);
    if (!entry || entry.resetAt <= now) {
        rateLimitMap.set(mapKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return;
    }
    if (entry.count >= RATE_LIMIT_MAX) {
        throw new common_1.HttpException('请求过于频繁，请稍后再试', common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
    entry.count += 1;
}
function setAuthCookie(res, token) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(jwt_auth_middleware_1.JWT_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        path: '/',
        maxAge: 2 * 60 * 60 * 1000,
    });
}
function clearAuthCookie(res) {
    res.clearCookie(jwt_auth_middleware_1.JWT_COOKIE_NAME, { path: '/' });
}
let AuthController = AuthController_1 = class AuthController {
    authService;
    db;
    logger = new common_1.Logger(AuthController_1.name);
    googleClientId;
    googleClientSecret;
    constructor(authService, db) {
        this.authService = authService;
        this.db = db;
        this.googleClientId = process.env.GOOGLE_CLIENT_ID;
        this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!this.googleClientId || !this.googleClientSecret) {
            this.logger.warn('Google OAuth not configured: GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET missing');
        }
    }
    async register(dto, req, res) {
        const ip = getClientIp(req);
        checkRateLimit(ip, `register:${dto.email}`);
        const result = await this.authService.register(dto);
        setAuthCookie(res, result.token);
        return { user: result.user };
    }
    async login(dto, req, res) {
        const ip = getClientIp(req);
        checkRateLimit(ip, `login:${dto.email}`);
        const result = await this.authService.login(dto);
        setAuthCookie(res, result.token);
        return { user: result.user };
    }
    async refresh(req, res) {
        if (!req.user) {
            throw new common_1.UnauthorizedException('未登录');
        }
        const user = await this.authService.getUserById(req.user.id);
        if (!user) {
            throw new common_1.UnauthorizedException('用户不存在');
        }
        const token = this.authService.generateToken(user);
        setAuthCookie(res, token);
        return { user };
    }
    async me(req) {
        if (!req.user)
            return null;
        return this.authService.getUserById(req.user.id);
    }
    getGoogleStatus() {
        const configured = !!(this.googleClientId && this.googleClientSecret);
        return {
            configured,
            clientId: configured ? this.googleClientId : undefined,
        };
    }
    async googleAuth(res) {
        if (!this.googleClientId || !this.googleClientSecret) {
            throw new common_1.BadRequestException('Google 登录未配置，请设置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 环境变量');
        }
        const redirectUri = `${process.env.APP_URL || ''}/api/auth/google/callback`;
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
            `?client_id=${this.googleClientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=email%20profile`;
        res.redirect(googleAuthUrl);
    }
    async googleCallback(code, error, res) {
        if (!this.googleClientId || !this.googleClientSecret) {
            res.redirect('/login?google_error=not_configured');
            return;
        }
        if (error) {
            this.logger.warn('Google OAuth denied', error);
            res.redirect('/login?google_error=denied');
            return;
        }
        if (!code) {
            res.redirect('/login?google_error=no_code');
            return;
        }
        try {
            const redirectUri = `${process.env.APP_URL || ''}/api/auth/google/callback`;
            const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: this.googleClientId,
                    client_secret: this.googleClientSecret,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                }),
            });
            if (!tokenResp.ok) {
                const text = await tokenResp.text();
                this.logger.error('Google token exchange failed', text);
                res.redirect('/login?google_error=token_exchange_failed');
                return;
            }
            const tokenData = await tokenResp.json();
            const accessToken = tokenData.access_token;
            if (!accessToken) {
                res.redirect('/login?google_error=no_access_token');
                return;
            }
            const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!userInfoResp.ok) {
                const text = await userInfoResp.text();
                this.logger.error('Google userinfo failed', text);
                res.redirect('/login?google_error=userinfo_failed');
                return;
            }
            const userInfo = await userInfoResp.json();
            const email = (userInfo.email ?? '').toLowerCase();
            const name = userInfo.name || email.split('@')[0] || 'Google 用户';
            if (!email) {
                res.redirect('/login?google_error=no_email');
                return;
            }
            const existingRows = await this.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
            let userRow;
            if (existingRows.length > 0) {
                userRow = existingRows[0];
            }
            else {
                const randomPw = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
                const inserted = await this.db
                    .insert(schema_1.users)
                    .values({
                    email,
                    passwordHash: randomPw,
                    name,
                    role: 'buyer',
                })
                    .returning();
                userRow = inserted[0];
            }
            const user = {
                id: userRow.id,
                email: userRow.email,
                name: userRow.name,
                role: userRow.role,
                createdAt: userRow.createdAt.toISOString(),
            };
            const token = this.authService.generateToken(user);
            setAuthCookie(res, token);
            res.redirect('/');
        }
        catch (err) {
            this.logger.error('Google OAuth callback error', err);
            res.redirect('/login?google_error=server_error');
        }
    }
    async logout(res) {
        clearAuthCookie(res);
        return { success: true };
    }
    async mergeCart(req, body) {
        const userId = req.user?.id;
        if (!userId)
            return { success: false };
        await this.authService.mergeGuestCart(userId, body.sessionId);
        return { success: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['buyer', 'seller', 'admin'])),
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('google/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AuthController.prototype, "getGoogleStatus", null);
__decorate([
    (0, common_1.Get)('google'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('error')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('merge-cart'),
    (0, common_1.UseGuards)(new roles_guard_1.RolesGuard(['buyer', 'seller', 'admin'])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "mergeCart", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('api/auth'),
    __param(1, (0, common_1.Inject)(database_provider_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [auth_service_1.AuthService, Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map