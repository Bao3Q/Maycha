# System architecture

```mermaid
flowchart LR
    Browser[Customer browser] -->|HTTP :3000| Web[Next.js web app]
    Web -->|HTTP API :3001| API[NestJS API]
    API -->|Prisma ORM| DB[(PostgreSQL)]
    API -->|JWT auth| Auth[Authentication and authorization]
```

The web app is in `apps/web/`; the API and Prisma persistence layer are in `apps/api/`. End-to-end API tests are in `tests/api/`. Docker Compose builds both apps and keeps PostgreSQL data in the `db_data` named volume.
