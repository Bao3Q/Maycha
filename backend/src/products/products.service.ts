import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private products = [
    {
      id: '1',
      name: 'Hồng Trà Bí Đao',
      price: 35000,
      imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfPmaUq0ZUeh60MyAzdACJq5NI9F-9tj4X2Qdkk9zRQQ&s=10',
      stock: 50,
    },
    {
      id: '2',
      name: 'Trà Đào Cam Sả',
      price: 39000,
      imageUrl: 'https://cdn.tgdd.vn/2020/07/CookRecipe/GalleryStep/thanh-pham-273.jpg',
      stock: 40,
    },
    {
      id: '3',
      name: 'Cà Phê Sữa Pha Máy',
      price: 30000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500',
      stock: 30,
    },
    {
      id: '4',
      name: 'Cappuccino',
      price: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500',
      stock: 25,
    },
  ];

  create(createProductDto: CreateProductDto) {
    return 'This action adds a new product';
  }

  findAll() {
    return this.products;
  }

  findOne(id: string) {
    return this.products.find((item) => item.id === id);
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}