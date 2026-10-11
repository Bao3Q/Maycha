import { Type } from 'class-transformer';
import { 
  IsArray, 
  IsEnum, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  Min, 
  ValidateNested 
} from 'class-validator';

export enum OrderSize {
  S = 'S',
  M = 'M',
  L = 'L',
}

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsEnum(OrderSize)
  @IsNotEmpty()
  size: OrderSize;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toppings?: string[];

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}