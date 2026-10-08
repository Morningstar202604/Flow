import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller()
export class ViewController {
  @Get(['/', '*'])
  async render(@Req() req: Request): Promise<unknown> {
    return { message: 'GlobalEcom AI API', path: req.path };
  }
}
