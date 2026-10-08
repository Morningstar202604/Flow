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
var JwtAuthMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthMiddleware = exports.JWT_COOKIE_NAME = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
exports.JWT_COOKIE_NAME = 'globalecom_auth';
let JwtAuthMiddleware = JwtAuthMiddleware_1 = class JwtAuthMiddleware {
    jwtService;
    logger = new common_1.Logger(JwtAuthMiddleware_1.name);
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    use(req, _res, next) {
        let token = null;
        const cookieToken = req.cookies?.[exports.JWT_COOKIE_NAME];
        if (cookieToken && typeof cookieToken === 'string') {
            token = cookieToken;
        }
        else {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            next();
            return;
        }
        try {
            const payload = this.jwtService.verify(token);
            req.user = payload;
        }
        catch (err) {
            this.logger.warn('Invalid JWT token', err.message);
        }
        next();
    }
};
exports.JwtAuthMiddleware = JwtAuthMiddleware;
exports.JwtAuthMiddleware = JwtAuthMiddleware = JwtAuthMiddleware_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], JwtAuthMiddleware);
//# sourceMappingURL=jwt-auth.middleware.js.map