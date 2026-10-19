import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user.interface';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() createPaymentDto: CreatePaymentDto,
    @Headers('idempotency-key') headerKey?: string,
    @Headers('x-idempotency-key') xHeaderKey?: string,
  ) {
    // Ưu tiên key từ header nếu có, nếu không thì dùng key từ body
    const idempotencyKey =
      headerKey || xHeaderKey || createPaymentDto.idempotencyKey;
    return this.paymentsService.processPayment(user.id, {
      orderId: createPaymentDto.orderId,
      method: createPaymentDto.method,
      idempotencyKey,
    });
  }

  /** Task 10.4: Xem điểm thưởng tích lũy của tài khoản */
  @Get('loyalty')
  async getLoyalty(@CurrentUser() user: AuthUser) {
    return {
      userId: user.id,
      loyaltyPoints: await this.paymentsService.getLoyaltyPoints(user.id),
    };
  }
}
