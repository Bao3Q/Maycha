import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, JwtAuthGuard],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
