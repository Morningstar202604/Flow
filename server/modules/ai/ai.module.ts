import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditModule } from '../audit/audit.module';
import { AiController } from './ai.controller';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { CustomAgentsService } from './custom-agents.service';
import { AiGatewayService } from './ai-gateway.service';
import { CopywriterService } from './copywriter.service';
import { SupportService } from './support.service';
import { TrendService } from './trend.service';
import { SelectService } from './select.service';
import { TranslationService } from './translation.service';

@Module({
  imports: [HttpModule, AuditModule],
  controllers: [AiController, AiSettingsController],
  providers: [
    AiGatewayService,
    AiSettingsService,
    CustomAgentsService,
    CopywriterService,
    SupportService,
    TrendService,
    SelectService,
    TranslationService,
  ],
  exports: [AiGatewayService],
})
export class AiModule {}
