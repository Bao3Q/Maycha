import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsNotEmpty()
  orderId: number;

  @IsString()
  @IsNotEmpty()
  method: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
