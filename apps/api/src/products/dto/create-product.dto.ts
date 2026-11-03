
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsInt()
  @Min(0)
  stock: number;
}
