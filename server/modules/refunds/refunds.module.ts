import { Module } from '@nestjs/common';

import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
