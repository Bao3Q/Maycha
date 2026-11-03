
import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  OnModuleInit,
} from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../common/prisma.service';

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
}

export interface StockRequest {
  productId: string;
  qty: number;
}

@Injectable()
export class ProductsService implements OnModuleInit {
  private stockQueue: Promise<void> = Promise.resolve();

  private products: ProductItem[] = [
    {
      id: '1',
      name: 'Hồng Trà Bí Đao',
      price: 35000,
      imageUrl:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfPmaUq0ZUeh60MyAzdACJq5NI9F-9tj4X2Qdkk9zRQQ&s=10',
      stock: 50,
    },
    {
      id: '2',
      name: 'Trà Đào Cam Sả',
      price: 39000,
      imageUrl:
        'https://cdn.tgdd.vn/2020/07/CookRecipe/GalleryStep/thanh-pham-273.jpg',
      stock: 40,
    },
    {
      id: '3',
      name: 'Cà Phê Sữa Pha Máy',
      price: 30000,
      imageUrl:
        'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500',
      stock: 30,
    },
    {
      id: '4',
      name: 'Cappuccino',
      price: 45000,
      imageUrl:
        'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500',
      stock: 25,
    },
  ];

  constructor(
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService | null,
  ) {}

  // Khởi tạo dữ liệu sản phẩm mẫu
  async onModuleInit(): Promise<void> {
    if (!this.prisma) return;

    for (const product of this.products) {
      await this.prisma.product.upsert({
        where: { id: product.id },
        create: product,
        update: {
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
        },
      });
    }
  }

  // ADMIN: Thêm sản phẩm
  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductItem> {
    const newProduct: ProductItem = {
      id: randomUUID(),
      name: createProductDto.name,
      price: createProductDto.price,
      imageUrl: createProductDto.imageUrl,
      stock: createProductDto.stock,
    };

    if (this.prisma) {
      return this.prisma.product.create({
        data: newProduct,
      });
    }

    this.products.push(newProduct);

    return { ...newProduct };
  }

  // Xem danh sách sản phẩm
  async findAll(): Promise<ProductItem[]> {
    if (this.prisma) {
      return this.prisma.product.findMany({
        orderBy: { id: 'asc' },
      });
    }

    return this.products.map((product) => ({ ...product }));
  }

  // Tìm sản phẩm trong bộ nhớ
  findOne(id: string): ProductItem | undefined {
    const product = this.products.find(
      (item) => item.id === id,
    );

    return product ? { ...product } : undefined;
  }

  // Xem chi tiết sản phẩm
  async findOneFromStorage(
    id: string,
  ): Promise<ProductItem | undefined> {
    if (this.prisma) {
      return (
        (await this.prisma.product.findUnique({
          where: { id },
        })) ?? undefined
      );
    }

    return this.findOne(id);
  }

  // ADMIN: Cập nhật sản phẩm
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductItem> {
    if (this.prisma) {
      try {
        return await this.prisma.product.update({
          where: { id },
          data: updateProductDto,
        });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException(
            `Sản phẩm với ID ${id} không tồn tại`,
          );
        }

        throw error;
      }
    }

    const index = this.products.findIndex(
      (product) => product.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Sản phẩm với ID ${id} không tồn tại`,
      );
    }

    this.products[index] = {
      ...this.products[index],
      ...updateProductDto,
    };

    return { ...this.products[index] };
  }

  // ADMIN: Xóa sản phẩm
  async remove(id: string): Promise<ProductItem> {
    if (this.prisma) {
      try {
        return await this.prisma.product.delete({
          where: { id },
        });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException(
            `Sản phẩm với ID ${id} không tồn tại`,
          );
        }

        throw error;
      }
    }

    const index = this.products.findIndex(
      (product) => product.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Sản phẩm với ID ${id} không tồn tại`,
      );
    }

    const deletedProduct = this.products[index];

    this.products.splice(index, 1);

    return { ...deletedProduct };
  }

  /** Trừ tồn kho */
  deductStock(
    productId: string,
    qty: number,
  ): {
    product: ProductItem;
    remainingStock: number;
  } {
    const product = this.products.find(
      (item) => item.id === productId,
    );

    if (!product) {
      throw new NotFoundException(
        `Sản phẩm với ID ${productId} không tồn tại`,
      );
    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      throw new BadRequestException(
        'Số lượng đặt phải là số nguyên dương',
      );
    }

    if (product.stock < qty) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
      );
    }

    product.stock -= qty;

    return {
      product: { ...product },
      remainingStock: product.stock,
    };
  }

  /** Đặt trước tồn kho */
  withStockReservation<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(
      requests,
      'reserve',
      operation,
    );
  }

  /** Hoàn trả tồn kho */
  withStockRestoration<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(
      requests,
      'restore',
      operation,
    );
  }

  private async withStockTransaction<T>(
    requests: StockRequest[],
    operationType: 'reserve' | 'restore',
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.stockQueue;

    let release!: () => void;

    this.stockQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await this.applyStockTransaction(
        requests,
        operationType,
        operation,
      );
    } finally {
      release();
    }
  }

  private async applyStockTransaction<T>(
    requests: StockRequest[],
    operationType: 'reserve' | 'restore',
    operation: () => Promise<T>,
  ): Promise<T> {
    const quantities = new Map<string, number>();

    for (const { productId, qty } of requests) {
      if (
        !productId ||
        !Number.isSafeInteger(qty) ||
        qty <= 0
      ) {
        throw new BadRequestException(
          'Sản phẩm và số lượng đặt không hợp lệ',
        );
      }

      const totalQty =
        (quantities.get(productId) ?? 0) + qty;

      if (!Number.isSafeInteger(totalQty)) {
        throw new BadRequestException(
          'Tổng số lượng sản phẩm không hợp lệ',
        );
      }

      quantities.set(productId, totalQty);
    }

    for (const [productId, qty] of quantities) {
      const product = this.products.find(
        (item) => item.id === productId,
      );

      if (!product) {
        throw new NotFoundException(
          `Sản phẩm với ID ${productId} không tồn tại`,
        );
      }

      if (
        operationType === 'reserve' &&
        product.stock < qty
      ) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
        );
      }

      if (
        operationType === 'restore' &&
        !Number.isSafeInteger(product.stock + qty)
      ) {
        throw new BadRequestException(
          'Số lượng tồn kho sau khi hoàn không hợp lệ',
        );
      }
    }

    const changedProductIds: string[] = [];

    try {
      for (const [productId, qty] of quantities) {
        if (operationType === 'reserve') {
          this.deductStock(productId, qty);
        } else {
          const product = this.products.find(
            (item) => item.id === productId,
          )!;

          product.stock += qty;
        }

        changedProductIds.push(productId);
      }

      return await operation();
    } catch (error) {
      for (const productId of changedProductIds) {
        const product = this.products.find(
          (item) => item.id === productId,
        );

        if (product) {
          const qty = quantities.get(productId)!;

          product.stock +=
            operationType === 'reserve' ? qty : -qty;
        }
      }

      throw error;
    }
  }

  /** Thiết lập tồn kho trong unit test */
  setStockForTest(
    productId: string,
    stock: number,
  ): void {
    const product = this.products.find(
      (item) => item.id === productId,
    );

    if (product) {
      product.stock = stock;
    }
  }
}
