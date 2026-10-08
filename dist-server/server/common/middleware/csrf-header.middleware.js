"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsrfHeaderMiddleware = void 0;
const common_1 = require("@nestjs/common");
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
let CsrfHeaderMiddleware = class CsrfHeaderMiddleware {
    use(req, _res, next) {
        const method = req.method.toUpperCase();
        if (!STATE_CHANGING_METHODS.includes(method)) {
            next();
            return;
        }
        const header = req.headers['x-requested-with'];
        if (!header || header !== 'XMLHttpRequest') {
            throw new common_1.ForbiddenException('CSRF 校验失败：缺少 X-Requested-With 请求头');
        }
        next();
    }
};
exports.CsrfHeaderMiddleware = CsrfHeaderMiddleware;
exports.CsrfHeaderMiddleware = CsrfHeaderMiddleware = __decorate([
    (0, common_1.Injectable)()
], CsrfHeaderMiddleware);
//# sourceMappingURL=csrf-header.middleware.js.map