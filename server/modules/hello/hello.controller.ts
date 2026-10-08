import { Controller, Get } from '@nestjs/common';

@Controller()
export class HelloController {
  @Get('health')
  health(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'GlobalEcom AI',
    };
  }

  @Get('info')
  apiInfo(): { name: string; version: string; docs: string } {
    return {
      name: 'GlobalEcom AI API',
      version: '1.1.0',
      docs: '/api/health',
    };
  }
}
