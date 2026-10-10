import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { DemoController } from '../dev/demo.controller';

@Module({
  // DemoController tự trả 404 khi ENABLE_DEMO_SEED khác "true".
  controllers: [OrdersController, DemoController],
  providers: [OrdersService, OrdersRepository, JwtAuthGuard],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
