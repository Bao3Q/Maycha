import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SepayWebhookGuard } from './sepay-webhook.guard';

describe('SepayWebhookGuard', () => {
  const originalApiKey = process.env.SEPAY_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.SEPAY_API_KEY;
    else process.env.SEPAY_API_KEY = originalApiKey;
  });

  function context(authorization: string): ExecutionContext {
    const request = { header: () => authorization };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('accepts the configured SePay API key', () => {
    process.env.SEPAY_API_KEY = 'secret-key';

    expect(
      new SepayWebhookGuard().canActivate(context('Apikey secret-key')),
    ).toBe(true);
  });

  it('rejects a missing or incorrect API key', () => {
    process.env.SEPAY_API_KEY = 'secret-key';

    expect(() =>
      new SepayWebhookGuard().canActivate(context('Apikey wrong-key')),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when the webhook key is not configured', () => {
    delete process.env.SEPAY_API_KEY;

    expect(() =>
      new SepayWebhookGuard().canActivate(context('Apikey secret-key')),
    ).toThrow(ServiceUnavailableException);
  });
});
