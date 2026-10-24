# Maycha API

NestJS API with PostgreSQL persistence through Prisma. Run API commands from this directory.

## Local development

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL` and `JWT_SECRET`.
3. Generate Prisma Client and apply migrations:

   ```powershell
   npm run prisma:generate
   npm run prisma:deploy
   ```

4. Start the API with `npm run start:dev`.

The API listens on port `3001` by default. Docker Compose starts PostgreSQL and applies migrations automatically.

## SePay QR payments

Set `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`, and
`SEPAY_API_KEY` in `apps/api/.env` for local development. The SePay webhook must
send `Authorization: Apikey <SEPAY_API_KEY>` to
`POST /payments/sepay/webhook`. For a local server, expose the API through a
public HTTPS tunnel and register that public webhook URL in SePay.

Use a dedicated SePay test bank account when testing QR transfers. A QR transfer
can move real money; test mode does not make a live bank account a sandbox.
Payment status changes only after the webhook key, receiving account, transfer
direction, order reference, and exact amount are verified.

## Validation

`npm run build` regenerates Prisma Client from `prisma/schema.prisma` before compiling NestJS.

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

End-to-end tests are maintained in `../../tests/api/`.
