"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    const isProd = process.env.NODE_ENV === 'production';
    app.enableCors({
        origin: isProd
            ? (process.env.CORS_ORIGINS?.split(',') ?? [process.env.APP_URL ?? 'http://localhost:3000'])
            : true,
        credentials: true,
    });
    app.setGlobalPrefix('api');
    const port = parseInt(process.env.PORT ?? '3000', 10);
    await app.listen(port);
    common_1.Logger.log(`GlobalEcom AI server running on http://localhost:${port}/api`, 'Bootstrap');
}
void bootstrap();
//# sourceMappingURL=main.js.map