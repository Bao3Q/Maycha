import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Phương thức thanh toán (mock):
 *  - WALLET: ví điện tử, CARD: thẻ ngân hàng → thanh toán thành công.
 *  - FAIL: giả lập cổng thanh toán báo lỗi → đơn chuyển PAYMENT_FAILED
 *    (dùng khi demo nhánh lỗi).
 */
export const PAYMENT_METHODS = [
  'WALLET',
  'CARD',
  'MOMO',
  'VNPAY',
  'FAIL',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class CreatePaymentDto {
  @IsInt()
  orderId: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
