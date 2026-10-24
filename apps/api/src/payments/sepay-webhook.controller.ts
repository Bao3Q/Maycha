import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SepayService } from './sepay.service';
import { SepayWebhookGuard } from './sepay-webhook.guard';

@Controller('payments/sepay')
export class SepayWebhookController {
  constructor(private readonly sepayService: SepayService) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(SepayWebhookGuard)
  async handleWebhook(@Body() payload: unknown) {
    await this.sepayService.handleWebhook(payload);
    return { success: true };
  }
}
