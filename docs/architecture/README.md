# Architecture and database schema

## Current schema

The authoritative database definition is [`../../apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma), with the ordered migrations in [`../../apps/api/prisma/migrations/`](../../apps/api/prisma/migrations/). Apply committed migrations with `npm run prisma:deploy` from `apps/api/` or through Docker Compose.

## Legacy SQL draft

[`legacy-schema.sql`](legacy-schema.sql) is the earlier assignment/schema draft retained for reference only. Do not execute it against the application database: it may not match the current Prisma schema or migration history.
