import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { RolesGuard } from '@server/common/guards/roles.guard';
import { AddressesService } from './addresses.service';
import type { CreateAddressDto, UpdateAddressDto } from './addresses.service';

@Controller('api/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async list(@Req() req: Request) {
    const userId = req.user?.id as string;
    return this.addressesService.list(userId);
  }

  @Get(':id')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.id as string;
    return this.addressesService.getOne(userId, id);
  }

  @Post()
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async create(@Req() req: Request, @Body() body: CreateAddressDto) {
    const userId = req.user?.id as string;
    return this.addressesService.create(userId, body);
  }

  @Put(':id')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateAddressDto,
  ) {
    const userId = req.user?.id as string;
    return this.addressesService.update(userId, id, body);
  }

  @Delete(':id')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.id as string;
    return this.addressesService.remove(userId, id);
  }

  @Put(':id/default')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async setDefault(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.id as string;
    return this.addressesService.setDefault(userId, id);
  }
}
