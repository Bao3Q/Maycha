import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class SepayWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.SEPAY_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'SePay webhook chưa được cấu hình',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization') ?? '';
    const match = /^Apikey\s+(.+)$/i.exec(authorization);
    const providedKey = match?.[1] ?? '';
    const expected = Buffer.from(apiKey);
    const provided = Buffer.from(providedKey);

    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new UnauthorizedException('SePay API key không hợp lệ');
    }
    return true;
  }
}
