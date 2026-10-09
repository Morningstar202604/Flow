import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { CopywriterService } from './copywriter.service';
import { SupportService } from './support.service';
import { TrendService } from './trend.service';
import { SelectService } from './select.service';
import { TranslationService } from './translation.service';

@Module({
  imports: [HttpModule],
  controllers: [AiController],
  providers: [
    AiGatewayService,
    CopywriterService,
    SupportService,
    TrendService,
    SelectService,
    TranslationService,
  ],
})
export class AiModule {}
