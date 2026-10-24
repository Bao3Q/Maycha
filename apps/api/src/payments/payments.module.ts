import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { SepayWebhookController } from './sepay-webhook.controller';
import { SepayWebhookGuard } from './sepay-webhook.guard';
import { SepayService } from './sepay.service';
import { PaymentsService } from './payments.service';
import { OrdersModule } from '../orders/orders.module';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, SepayWebhookController],
  providers: [PaymentsService, SepayService, SepayWebhookGuard, JwtAuthGuard],
})
export class PaymentsModule {}
