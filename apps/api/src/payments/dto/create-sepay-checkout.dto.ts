import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class CreateSePayCheckoutDto {
  @IsInt()
  orderId: number;

  /** Bắt đầu phiên mới sau khi phiên cũ hết hạn (1 phút). */
  @IsOptional()
  @IsBoolean()
  restart?: boolean;
}
