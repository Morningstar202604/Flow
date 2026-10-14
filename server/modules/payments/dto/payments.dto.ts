import { IsIn, IsUUID } from 'class-validator';
import type { PaymentProvider } from '../../../../shared/api.interface';

const PROVIDERS: PaymentProvider[] = ['stripe', 'paypal', 'demo'];

export class PayDto {
  @IsUUID(undefined, { message: 'orderId 必须是合法 UUID' })
  orderId!: string;

  @IsIn(PROVIDERS, { message: '不支持的支付方式' })
  provider!: PaymentProvider;
}
