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

## Validation

`npm run build` regenerates Prisma Client from `prisma/schema.prisma` before compiling NestJS.

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

End-to-end tests are maintained in `../../tests/api/`.
