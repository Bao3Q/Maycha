import { IsInt } from 'class-validator';

export class CreateSePayCheckoutDto {
  @IsInt()
  orderId: number;
}
