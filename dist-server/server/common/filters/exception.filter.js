"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const exception_interface_1 = require("../interfaces/exception.interface");
const api_response_code_1 = require("../constants/api_response_code");
// 全局异常过滤器，用于捕获所有未处理的异常
let GlobalExceptionFilter = class GlobalExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        // 如果响应头已发送，则不处理
        if (response.headersSent) {
            return;
        }
        let errorResponse;
        let httpStatus;
        if (exception instanceof exception_interface_1.BusinessException) {
            // 业务异常
            httpStatus = exception.httpStatus;
            errorResponse = {
                error: {
                    code: exception.code,
                    message: exception.message,
                    details: exception.details,
                    fieldErrors: exception.fieldErrors,
                    timestamp: Date.now(),
                },
            };
        }
        else if (exception instanceof common_1.HttpException) {
            // HTTP异常
            httpStatus = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            errorResponse = {
                error: {
                    code: api_response_code_1.HTTP_STATUS_TO_RESPONSE_CODE_MAP[httpStatus],
                    message: typeof exceptionResponse === 'string' ? exceptionResponse : exception.message,
                    details: typeof exceptionResponse === 'object' ? JSON.stringify(exceptionResponse) : undefined,
                    timestamp: Date.now(),
                },
            };
        }
        else if (typeof exception === 'object' &&
            exception !== null &&
            exception.code === '22P02') {
            // Postgres invalid_text_representation：路径/查询参数与列类型不匹配（最常见是非法 UUID）
            // 与「合法 UUID 但记录不存在」走同一条 not-found 语义，避免 500 噪声
            httpStatus = common_1.HttpStatus.NOT_FOUND;
            errorResponse = {
                error: {
                    code: api_response_code_1.ResponseCode.NOT_FOUND,
                    message: '资源不存在',
                    timestamp: Date.now(),
                },
            };
        }
        else {
            // 未知异常
            httpStatus = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            const logger = new common_1.Logger('GlobalExceptionFilter');
            logger.error('Unhandled exception', exception.stack);
            const isProd = process.env.NODE_ENV === 'production';
            if (isProd) {
                errorResponse = {
                    error: {
                        code: api_response_code_1.ResponseCode.INTERNAL_ERROR,
                        message: '服务器内部错误',
                        timestamp: Date.now(),
                    },
                };
            }
            else {
                errorResponse = {
                    error: {
                        code: api_response_code_1.ResponseCode.INTERNAL_ERROR,
                        message: '服务器内部错误',
                        stack: exception.stack,
                        cause: exception.cause,
                        timestamp: Date.now(),
                    },
                };
            }
        }
        response.status(httpStatus).json(errorResponse);
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=exception.filter.js.map