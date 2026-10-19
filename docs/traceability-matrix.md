# Implementation traceability

This is a source-code navigation aid for the current application; it is not a claim of formal assignment acceptance.

| Feature area | Implementation | Verification |
| --- | --- | --- |
| Product catalog and inventory | `apps/api/src/products/`, `apps/web/app/page.tsx` | `tests/api/checkout.e2e-spec.ts` |
| Registration, login, and JWT | `apps/api/src/auth/`, `apps/web/app/login/page.tsx` | `apps/api/src/auth/auth.service.spec.ts`; `tests/api/auth.e2e-spec.ts` |
| Order lifecycle and checkout | `apps/api/src/orders/`, `apps/web/app/orders/` | `apps/api/src/orders/orders.service.spec.ts`; `tests/api/orders.e2e-spec.ts` and `tests/api/checkout.e2e-spec.ts` |
| Payments and loyalty | `apps/api/src/payments/` | `apps/api/src/orders/backend.advanced.spec.ts`; checkout E2E tests |
| PostgreSQL persistence | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` | `apps/api/src/orders/backend.advanced.spec.ts`; CI applies migrations |
| Container deployment | `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile` | Docker Compose configuration validation; `.github/workflows/ci.yml` builds and tests both apps |
