import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Cấu hình dùng chung cho main.ts và test e2e, để test chạy giống hệt
 * server thật.
 *
 * ValidationPipe toàn cục: mọi DTO có decorator class-validator
 * (CreateOrderDto, CreatePaymentDto, ...) đều được kiểm tra → sai dữ liệu
 * trả 400. `whitelist` bỏ field lạ, `transform` chuyển body thành instance
 * DTO (cần cho @ValidateNested + @Type ở danh sách món).
 */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
}
