
import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Cấu hình dùng chung cho main.ts và test e2e.
 */
export function setupApp(app: INestApplication): void {
  // Kiểm tra dữ liệu DTO toàn cục
  app.useGlobalPipes

  // Kiểm tra dữ liệu DTO toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
}
