import {
  BadRequestException,
  ConflictException,
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
  version: number;
}

export interface StockRequest {
  productId: string;
  qty: number;
}

@Injectable()
export class ProductsService implements OnModuleInit {
  private products: ProductItem[] = [
    {
      id: '1',
      name: 'Hồng Trà Bí Đao',
      price: 35000,
      imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfPmaUq0ZUeh60MyAzdACJq5NI9F-9tj4X2Qdkk9zRQQ&s=10',
      stock: 50,
      version: 1,
    },
    {
      id: '2',
      name: 'Trà Đào Cam Sả',
      price: 39000,
      imageUrl: 'https://cdn.tgdd.vn/2020/07/CookRecipe/GalleryStep/thanh-pham-273.jpg',
      stock: 40,
      version: 1,
    },
    {
      id: '3',
      name: 'Cà Phê Sữa Pha Máy',
      price: 30000,
      imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500',
      stock: 30,
      version: 1,
    },
    {
      id: '4',
      name: 'Cappuccino',
      price: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500',
      stock: 25,
      version: 1,
    },
  ];

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

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

  create(createProductDto: CreateProductDto) {
    return 'This action adds a new product';
  }

  async findAll(): Promise<ProductItem[]> {
    if (this.prisma) {
      return this.prisma.product.findMany({ orderBy: { id: 'asc' } });
    }
    return this.products.map((product) => ({ ...product }));
  }

  findOne(id: string): ProductItem | undefined {
    const product = this.products.find((item) => item.id === id);
    return product ? { ...product } : undefined;
  }

  async findOneFromStorage(id: string): Promise<ProductItem | undefined> {
    if (this.prisma) {
      return (await this.prisma.product.findUnique({ where: { id } })) ?? undefined;
    }
    return this.findOne(id);
  }

  /**
   * Trừ tồn kho với kiểm soát đồng thời (Optimistic Locking) theo Task 10.3.
   * Bắt buộc kiểm tra version mà bên gọi đã đọc trước khi cập nhật.
   * Nếu stock < qty: ném BadRequestException.
   */
  deductStock(
    productId: string,
    qty: number,
    expectedVersion: number,
  ): { product: ProductItem; remainingStock: number } {
    const product = this.products.find((item) => item.id === productId);
    if (!product) {
      throw new NotFoundException(`Sản phẩm với ID ${productId} không tồn tại`);
    }

    if (!Number.isSafeInteger(qty) || qty <= 0) {
      throw new BadRequestException('Số lượng đặt phải là số nguyên dương');
    }

    if (product.version !== expectedVersion) {
      throw new ConflictException(
        `Xung đột dữ liệu (Optimistic Lock): sản phẩm "${product.name}" đã bị thay đổi bởi giao dịch khác`,
      );
    }

    if (product.stock < qty) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
      );
    }

    product.stock -= qty;
    product.version += 1;

    return { product: { ...product }, remainingStock: product.stock };
  }

  /** In-memory transaction used by isolated tests; production orders use Prisma transactions. */
  withStockReservation<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(requests, 'reserve', operation);
  }

  withStockRestoration<T>(
    requests: StockRequest[],
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.withStockTransaction(requests, 'restore', operation);
  }

  private async withStockTransaction<T>(
    requests: StockRequest[],
    operationType: 'reserve' | 'restore',
    operation: () => Promise<T>,
  ): Promise<T> {
    const quantities = new Map<string, number>();
    for (const { productId, qty } of requests) {
      if (!productId || !Number.isSafeInteger(qty) || qty <= 0) {
        throw new BadRequestException('Sản phẩm và số lượng đặt không hợp lệ');
      }

      const totalQty = (quantities.get(productId) ?? 0) + qty;
      if (!Number.isSafeInteger(totalQty)) {
        throw new BadRequestException('Tổng số lượng sản phẩm không hợp lệ');
      }
      quantities.set(productId, totalQty);
    }

    const snapshots = new Map<string, { stock: number; version: number }>();
    for (const [productId, qty] of quantities) {
      const product = this.products.find((item) => item.id === productId);
      if (!product) {
        throw new NotFoundException(
          `Sản phẩm với ID ${productId} không tồn tại`,
        );
      }
      if (operationType === 'reserve' && product.stock < qty) {
        throw new BadRequestException(
          `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
        );
      }
      if (
        operationType === 'restore' &&
        !Number.isSafeInteger(product.stock + qty)
      ) {
        throw new BadRequestException('Số lượng tồn kho sau khi hoàn không hợp lệ');
      }
      snapshots.set(productId, {
        stock: product.stock,
        version: product.version,
      });
    }

    const changedProductIds: string[] = [];
    try {
      for (const [productId, qty] of quantities) {
        const snapshot = snapshots.get(productId)!;
        if (operationType === 'reserve') {
          this.deductStock(productId, qty, snapshot.version);
        } else {
          const product = this.products.find((item) => item.id === productId)!;
          if (product.version !== snapshot.version) {
            throw new ConflictException(
              `Xung đột dữ liệu (Optimistic Lock): sản phẩm "${product.name}" đã bị thay đổi bởi giao dịch khác`,
            );
          }
          product.stock += qty;
          product.version += 1;
        }
        changedProductIds.push(productId);
      }
      return await operation();
    } catch (error) {
      for (const productId of changedProductIds) {
        const product = this.products.find((item) => item.id === productId);
        const snapshot = snapshots.get(productId)!;
        if (product) {
          product.stock = snapshot.stock;
          product.version = snapshot.version;
        }
      }
      throw error;
    }
  }

  /**
   * Dùng để thiết lập tồn kho mẫu trong unit/integration test.
   */
  setStockForTest(productId: string, stock: number, version = 1): void {
    const product = this.products.find((item) => item.id === productId);
    if (product) {
      product.stock = stock;
      product.version = version;
    }
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}